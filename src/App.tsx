import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import type { Address, Hex } from "viem";
import {
  createPublicClient,
  http,
  isAddress,
  parseEther,
  formatEther,
} from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { base, mainnet } from "wagmi/chains";

import { toast } from "sonner";

import type { TenderlySimulateResult } from "@/lib/tenderly";
import { hexToBigIntSafe } from "@/lib/format";
import {
  tenderlyGetSavedSimulationById,
  tenderlyListSavedSimulations,
  tenderlySimulateAndSave,
  type TenderlySimulateApiRequest,
} from "@/lib/tenderlyApi";

import { useLocalStorageState } from "@/hooks/useLocalStorageState";

import {
  type HistoryItem,
  HistoryDataTable,
} from "@/components/app/transaction/HistoryDataTable";
import { AppSidebar } from "@/components/app-sidebar";
import { GasView } from "@/components/app/dashboard/views/GasView";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { TransactionPanel } from "@/components/app/transaction/TransactionPanel";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { AssetsView } from "@/components/app/dashboard/views/AssetsView";
import { StateView } from "@/components/app/dashboard/views/StateView";
import { EventsView } from "@/components/app/dashboard/views/EventsView";

// ENS lives on Ethereum mainnet. Use a mainnet chain config (for ENS registry addresses)
// and an RPC that works from the browser.
const ENS_RPC_URL = "https://cloudflare-eth.com";
const ensPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(ENS_RPC_URL),
});

async function fetchBasePrimaryName(address: string): Promise<string | null> {
  const url = `https://api.basenames.xyz/v1/reverse?address=${address.toLowerCase()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Base name lookup failed (${res.status})`);
  }
  const data = await res.json();
  const name = data?.primary_name;
  return typeof name === "string" && name.trim().length ? name : null;
}

function isLikelyEnsName(value: string) {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("0x") || v.startsWith("0X")) return false;
  if (/\s/.test(v)) return false;
  const parts = v.split(".");
  if (parts.length < 2) return false;
  return parts.every((p) => p.length > 0);
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const [networkSwitchError, setNetworkSwitchError] = useState<string | null>(
    null
  );

  const {
    sendTransaction,
    data: txHash,
    error: sendError,
    isPending: isSending,
    reset: resetSendState,
  } = useSendTransaction();
  const [lastTx, setLastTx] = useState<{
    hash: Hex;
    chainId: number;
  } | null>(null);

  const [to, setTo] = useLocalStorageState("form-to", "");
  const [calldata, setCalldata] = useLocalStorageState("form-calldata", "");
  const [valueEth, setValueEth] = useLocalStorageState("form-value", "");
  const [gasLimit, setGasLimit] = useLocalStorageState("form-gas", "");
  const [simulateFrom, setSimulateFrom] = useLocalStorageState(
    "form-sim-from",
    ""
  );

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulation, setSimulation] = useState<TenderlySimulateResult | null>(
    null
  );
  const [simulationRequest, setSimulationRequest] = useState<any>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const tenderlyAccountSlug = (
    import.meta.env.VITE_TENDERLY_ACCOUNT_SLUG ?? ""
  ).trim();
  const tenderlyProjectSlug = (
    import.meta.env.VITE_TENDERLY_PROJECT_SLUG ?? ""
  ).trim();

  const tenderlySimulationId = simulation?.simulation?.id;
  const tenderlyDashboardUrl = useMemo(() => {
    if (!tenderlySimulationId || !tenderlyAccountSlug || !tenderlyProjectSlug)
      return null;
    return `https://dashboard.tenderly.co/${tenderlyAccountSlug}/${tenderlyProjectSlug}/simulator/${tenderlySimulationId}`;
  }, [tenderlySimulationId, tenderlyAccountSlug, tenderlyProjectSlug]);

  const queryClient = useQueryClient();

  const [executionHistory, setExecutionHistory] = useLocalStorageState<
    HistoryItem[]
  >("execution-history", []);

  // One-time cleanup: keep only executions in localStorage, simulations now come from Tenderly saved sims.
  useEffect(() => {
    setExecutionHistory((prev) => prev.filter((h) => h.type === "execution"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSimulationState = () => {
    setSimulation(null);
    setSimulationRequest(null);
    setSimulationError(null);
  };

  useEffect(() => {
    if (!txHash) return;
    setLastTx({ hash: txHash, chainId });
    setExecutionHistory((prev) => [
      {
        type: "execution",
        method:
          calldata === "" || calldata === "0x" ? "Transfer" : "Contract Call",
        from: address,
        to: to.trim(),
        value: valueEth,
        calldata,
        gasLimit,
        status: "success",
        hash: txHash,
        chainId,
        timestamp: Date.now(),
      },
      ...prev.filter((h) => h.type === "execution").slice(0, 49),
    ]);
  }, [txHash]);

  // Fetch ETH price for USD conversion
  const { data: ethPrice } = useQuery({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await res.json();
      return data.ethereum.usd as number;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const walletEnsNameQuery = useQuery({
    queryKey: ["ensName", address ?? null],
    enabled: Boolean(address),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!address) return null;
      return await ensPublicClient.getEnsName({ address });
    },
  });

  const walletBaseNameQuery = useQuery({
    queryKey: ["baseName", address?.toLowerCase() ?? null, chainId],
    enabled: Boolean(address && chainId === base.id),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      if (!address) return null;
      return await fetchBasePrimaryName(address);
    },
  });

  const walletEnsAvatarQuery = useQuery({
    queryKey: ["ensAvatar", walletEnsNameQuery.data ?? null],
    enabled: Boolean(walletEnsNameQuery.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!walletEnsNameQuery.data) return null;
      return await ensPublicClient.getEnsAvatar({
        name: walletEnsNameQuery.data,
      });
    },
  });

  const walletDisplayName =
    walletBaseNameQuery.data ?? walletEnsNameQuery.data ?? undefined;

  const toTrimmed = to.trim();
  const toIsAddress = isAddress(toTrimmed, { strict: false });
  const toAddressInput = toIsAddress ? (toTrimmed as Address) : undefined;
  const toEnsInput =
    !toIsAddress && isLikelyEnsName(toTrimmed) ? toTrimmed : undefined;

  const toEnsAddressQuery = useQuery({
    queryKey: ["ensAddress", toEnsInput?.toLowerCase() ?? null],
    enabled: Boolean(toEnsInput),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!toEnsInput) return null;
      return await ensPublicClient.getEnsAddress({ name: toEnsInput });
    },
  });

  const toResolvedAddress =
    toAddressInput ?? toEnsAddressQuery.data ?? undefined;

  const toEnsNameQuery = useQuery({
    queryKey: ["reverseName", toAddressInput ?? null, chainId],
    enabled: Boolean(toAddressInput),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!toAddressInput) return null;
      if (chainId === base.id) {
        const baseName = await fetchBasePrimaryName(toAddressInput);
        if (baseName) return baseName;
      }
      return await ensPublicClient.getEnsName({ address: toAddressInput });
    },
  });

  const isToEnsFetching = Boolean(
    (toEnsInput && toEnsAddressQuery.isFetching) || toEnsNameQuery.isFetching
  );

  const toEnsBadgeName =
    (toEnsInput && toEnsAddressQuery.data ? toEnsInput : undefined) ??
    toEnsNameQuery.data ??
    undefined;

  const toFieldError = !toTrimmed
    ? "Enter a destination address or ENS name."
    : toAddressInput
    ? undefined
    : toEnsInput
    ? toEnsAddressQuery.isFetching
      ? "Resolving ENS…"
      : toEnsAddressQuery.isError
      ? "ENS lookup failed."
      : toEnsAddressQuery.data === null
      ? "ENS name not found."
      : undefined
    : "Invalid address format.";

  const dataTrimmed = calldata.trim() || "0x";
  const dataLooksHex = /^0x[0-9a-fA-F]*$/.test(dataTrimmed);
  const dataEvenLength = dataTrimmed.length % 2 === 0;
  const dataIsValid = dataLooksHex && dataEvenLength;
  const dataHex = dataIsValid ? (dataTrimmed as Hex) : undefined;
  const dataBytes =
    dataLooksHex && dataTrimmed.length >= 2
      ? Math.max(0, (dataTrimmed.length - 2) / 2)
      : 0;

  let valueWei: bigint | undefined = undefined;
  let valueError: string | undefined = undefined;
  if (valueEth.trim() === "") {
    valueWei = 0n;
  } else {
    try {
      valueWei = parseEther(valueEth.trim());
    } catch {
      valueError = "Invalid ETH amount";
    }
  }

  let gasWei: bigint | undefined = undefined;
  let gasError: string | undefined = undefined;
  if (gasLimit.trim() !== "") {
    if (!/^\d+$/.test(gasLimit.trim())) {
      gasError = "Gas limit must be an integer";
    } else {
      gasWei = BigInt(gasLimit.trim());
      if (gasWei <= 0n) gasError = "Gas limit must be > 0";
    }
  }

  const formError =
    toFieldError ||
    valueError ||
    gasError ||
    (!dataLooksHex ? "Invalid calldata" : undefined);

  const canSend = isConnected && !formError && !isSending && !isSwitching;
  const tenderlySupported = chainId === base.id;

  const simulateFromTrimmed = simulateFrom.trim();
  const simulateFromIsEmpty = simulateFromTrimmed === "";
  const simulateFromIsAddress =
    !simulateFromIsEmpty && isAddress(simulateFromTrimmed, { strict: false });
  const simulateFromAddress = simulateFromIsAddress
    ? (simulateFromTrimmed as Address)
    : undefined;

  const simulateFromReady = simulateFromIsEmpty
    ? Boolean(address)
    : Boolean(simulateFromAddress);

  const simulateFromError = simulateFromIsEmpty
    ? undefined
    : simulateFromIsAddress
    ? undefined
    : "Invalid simulation from address.";

  const canSimulate =
    tenderlySupported &&
    !formError &&
    !simulateFromError &&
    simulateFromReady &&
    !isSimulating &&
    !isSwitching;

  const walletEthBalanceQuery = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(address),
      refetchInterval: 15_000,
    },
  });
  const walletEthBalance = walletEthBalanceQuery.data?.formatted;

  const [activeView, setActiveView] = useState("new-transaction");

  const safeString = (v: unknown) =>
    typeof v === "string" && v.trim().length ? v.trim() : undefined;

  const safeNumber = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  const parseTimestampMs = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) {
      // Accept both seconds and milliseconds.
      return v < 10_000_000_000 ? v * 1000 : v;
    }
    if (typeof v === "string" && v.trim().length) {
      const ms = Date.parse(v);
      return Number.isFinite(ms) ? ms : undefined;
    }
    return undefined;
  };

  const formatWeiToEthString = (v: unknown): string | undefined => {
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return undefined;
      if (/^\d+$/.test(s)) return formatEther(BigInt(s));
      // Might already be formatted ETH (or non-numeric string); keep as-is.
      return s;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      // Most commonly 0. Treat as wei if it's an int-like value.
      if (Number.isInteger(v)) return formatEther(BigInt(v));
      return String(v);
    }
    return undefined;
  };

  const savedSimulationsQuery = useQuery({
    queryKey: ["tenderly-simulations"],
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const raw = await tenderlyListSavedSimulations();

      const toHistoryItem = (item: unknown): HistoryItem | null => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;

        const sim =
          obj.simulation && typeof obj.simulation === "object"
            ? (obj.simulation as Record<string, unknown>)
            : obj;
        const tx =
          obj.transaction && typeof obj.transaction === "object"
            ? (obj.transaction as Record<string, unknown>)
            : obj;

        const simulationId =
          safeString(obj.id) ||
          safeString(sim.id) ||
          safeString(obj.simulationId);
        if (!simulationId) return null;

        const createdAt =
          safeString(sim.created_at) ||
          safeString(obj.created_at) ||
          safeString(obj.createdAt);
        const timestamp =
          parseTimestampMs(createdAt) ||
          parseTimestampMs(obj.timestamp) ||
          parseTimestampMs(sim.created_at) ||
          Date.now();

        const networkId =
          safeString(sim.network_id) ||
          safeString(obj.network_id) ||
          safeString(tx.network_id);
        const parsedChainId = networkId ? Number(networkId) : undefined;
        const chainIdSafe =
          typeof parsedChainId === "number" && Number.isFinite(parsedChainId)
            ? parsedChainId
            : chainId;

        const from = safeString(tx.from) || safeString(sim.from);
        const to = safeString(tx.to) || safeString(sim.to);
        if (!to) return null;

        const calldata =
          safeString(tx.input) ||
          safeString(tx.data) ||
          safeString(obj.input) ||
          safeString(obj.data);

        const gasLimit =
          typeof tx.gas === "number" || typeof tx.gas === "string"
            ? String(tx.gas)
            : typeof sim.gas === "number" || typeof sim.gas === "string"
            ? String(sim.gas)
            : undefined;

        const valueEth =
          formatWeiToEthString(tx.value) ||
          formatWeiToEthString(sim.value) ||
          "0";

        const statusBool =
          typeof sim.status === "boolean"
            ? sim.status
            : typeof obj.status === "boolean"
            ? obj.status
            : undefined;
        const status =
          statusBool === true
            ? "success"
            : statusBool === false
            ? "reverted"
            : "unknown";

        const method =
          safeString(sim.method) ||
          safeString(obj.method) ||
          (calldata && calldata !== "0x" ? "Contract Call" : "Transfer");

        return {
          simulationId,
          type: "simulation",
          method,
          from,
          to,
          value: valueEth,
          calldata,
          gasLimit,
          timestamp,
          status,
          chainId: chainIdSafe,
        };
      };

      return raw.map(toHistoryItem).filter((x): x is HistoryItem => Boolean(x));
    },
  });

  const historyData = useMemo(() => {
    const sims = savedSimulationsQuery.data ?? [];
    const execs = Array.isArray(executionHistory)
      ? executionHistory.filter((h) => h.type === "execution")
      : [];
    return [...sims, ...execs].sort((a, b) => b.timestamp - a.timestamp);
  }, [savedSimulationsQuery.data, executionHistory]);

  const handleSimulate = async () => {
    if (
      !toResolvedAddress ||
      !dataHex ||
      valueWei === undefined ||
      simulateFromError
    )
      return;
    resetSimulationState();
    setIsSimulating(true);
    setActiveView("gas-overview"); // Switch to gas view on simulate
    try {
      const fromAddress = simulateFromIsEmpty ? address : simulateFromAddress;
      if (!fromAddress) throw new Error("Missing simulation from address");

      const req: TenderlySimulateApiRequest = {
        save: true,
        save_if_fails: true,
        simulation_type: "full",
        network_id: String(chainId),
        from: fromAddress,
        to: toResolvedAddress,
        input: dataHex,
        // When omitted, Tenderly will use the intrinsic/estimated gas.
        gas: gasWei !== undefined ? Number(gasWei) : undefined,
        value: valueWei.toString(),
      };

      setSimulationRequest(req);

      const result = await tenderlySimulateAndSave(req);
      setSimulation(result);
      queryClient.invalidateQueries({ queryKey: ["tenderly-simulations"] });
      toast.success("Simulation saved to Tenderly");
    } catch (e) {
      setSimulationError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSend = () => {
    if (!toResolvedAddress || !dataHex || valueWei === undefined) return;
    resetSendState();
    sendTransaction({
      to: toResolvedAddress,
      data: dataHex,
      value: valueWei,
      gas: gasWei,
    });
  };

  const handleClearForm = () => {
    resetSendState();
    setLastTx(null);
    resetSimulationState();
    setTo("");
    setValueEth("");
    setGasLimit("");
    setCalldata("");
    setSimulateFrom("");
  };

  const populateFormFromHistoryItem = (item: HistoryItem) => {
    setTo(item.to);
    setValueEth(item.value || "");
    setCalldata(item.calldata || "0x");
    setGasLimit(item.gasLimit || "");
    setSimulateFrom(item.from || "");
  };

  const populateFormFromSimResult = (result: TenderlySimulateResult) => {
    const tx = (result as any)?.transaction as any;
    const txTo = safeString(tx?.to);
    const txFrom = safeString(tx?.from);
    const txInput = safeString(tx?.input);
    const txGas = tx?.gas;
    const txValue = tx?.value;

    if (txTo) setTo(txTo);
    if (txFrom) setSimulateFrom(txFrom);
    if (txInput) setCalldata(txInput);
    if (
      typeof txGas === "number" ||
      (typeof txGas === "string" && txGas.trim().length)
    ) {
      setGasLimit(String(txGas));
    }
    const valueEth = formatWeiToEthString(txValue);
    if (valueEth !== undefined) setValueEth(valueEth);
  };

  const handleLoadHistoryItem = (item: HistoryItem) => {
    populateFormFromHistoryItem(item);
    setActiveView("new-transaction");
    toast.success("Loaded into form");
  };

  const handleViewSavedSimulation = async (item: HistoryItem) => {
    if (!item.simulationId) return;
    populateFormFromHistoryItem(item);
    resetSimulationState();
    setIsSimulating(true);
    setActiveView("gas-overview");
    try {
      const result = await tenderlyGetSavedSimulationById(item.simulationId);

      // Tenderly's saved-simulation GET endpoint may return only `simulation` metadata
      // (no trace/log/state). In that case, re-run a full simulation (without saving)
      // so the in-app dashboard has something to render.
      const hasAnyDetails =
        Array.isArray((result as any)?.trace) ||
        Array.isArray((result as any)?.logs) ||
        Array.isArray((result as any)?.stateChanges) ||
        Array.isArray((result as any)?.assetChanges) ||
        Array.isArray((result as any)?.balanceChanges) ||
        Array.isArray((result as any)?.exposureChanges);

      if (hasAnyDetails) {
        setSimulation(result);
        populateFormFromSimResult(result);
        toast.success("Loaded saved simulation");
        return;
      }

      const sim = (result as any)?.simulation as any;
      const from = safeString(sim?.from) ?? safeString(item.from);
      const toAddr = safeString(sim?.to) ?? safeString(item.to);
      const input = safeString(sim?.input) ?? safeString(item.calldata) ?? "0x";

      const gas =
        safeNumber(sim?.gas) ??
        safeNumber(item.gasLimit) ??
        Number(gasWei ?? 30_000_000n);

      const networkId =
        safeString(sim?.network_id) ??
        (typeof item.chainId === "number" ? String(item.chainId) : undefined) ??
        String(chainId);

      let valueWei: string | undefined =
        typeof sim?.value === "string" && sim.value.trim().length
          ? sim.value.trim()
          : undefined;
      if (!valueWei) {
        const eth = safeString(item.value);
        if (eth) {
          try {
            valueWei = parseEther(eth).toString();
          } catch {
            valueWei = undefined;
          }
        }
      }

      if (!from || !toAddr) throw new Error("Missing from/to for simulation");

      const req: TenderlySimulateApiRequest = {
        save: false,
        simulation_type: "full",
        network_id: networkId,
        from,
        to: toAddr,
        input,
        gas,
        value: valueWei ?? "0",
      };

      setSimulationRequest(req);
      const next = await tenderlySimulateAndSave(req);
      setSimulation(next);
      populateFormFromSimResult(next);
      toast.success("Loaded simulation details");
    } catch (e) {
      setSimulationError(
        e instanceof Error ? e.message : "Failed to load saved simulation"
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResimulateSavedSimulation = async (item: HistoryItem) => {
    if (!item.simulationId) return;
    resetSimulationState();
    setIsSimulating(true);
    setActiveView("gas-overview");
    try {
      // Use the ID to fetch the canonical transaction input, then simulate again.
      const prev = await tenderlyGetSavedSimulationById(item.simulationId);

      const tx = (prev as any)?.transaction as any;
      const from = safeString(tx?.from) ?? safeString(item.from);
      const toAddr = safeString(tx?.to) ?? safeString(item.to);
      const input = safeString(tx?.input) ?? safeString(item.calldata) ?? "0x";

      const gas =
        safeNumber(tx?.gas) ??
        safeNumber(item.gasLimit) ??
        Number(gasWei ?? 30_000_000n);

      let valueWei: string | undefined =
        typeof tx?.value === "string" && tx.value.trim().length
          ? tx.value.trim()
          : undefined;
      if (!valueWei) {
        const eth = safeString(item.value);
        if (eth) {
          try {
            valueWei = parseEther(eth).toString();
          } catch {
            valueWei = undefined;
          }
        }
      }

      if (!from || !toAddr)
        throw new Error("Missing from/to for re-simulation");

      const networkId =
        safeString((prev as any)?.simulation?.network_id) ?? String(chainId);

      const req: TenderlySimulateApiRequest = {
        save: true,
        save_if_fails: true,
        simulation_type: "full",
        network_id: networkId,
        from,
        to: toAddr,
        input,
        gas,
        value: valueWei ?? "0",
      };

      setSimulationRequest(req);
      const next = await tenderlySimulateAndSave(req);
      setSimulation(next);
      populateFormFromSimResult(next);
      queryClient.invalidateQueries({ queryKey: ["tenderly-simulations"] });
      toast.success("Re-simulated and saved");
    } catch (e) {
      setSimulationError(
        e instanceof Error ? e.message : "Re-simulation failed"
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const onSwitchChain = async (id: number) => {
    setNetworkSwitchError(null);
    try {
      await switchChainAsync({ chainId: id });
    } catch (e) {
      setNetworkSwitchError(
        e instanceof Error ? e.message : "Failed to switch network"
      );
    }
  };

  const transactionPanelProps = {
    chainId,
    isSwitching,
    onSwitchChain,
    networkSwitchError,
    to,
    setTo,
    valueEth,
    setValueEth,
    calldata,
    setCalldata,
    gasLimit,
    setGasLimit,
    ethPrice,
    walletEthBalance,
    toEnsName: toEnsBadgeName ?? undefined,
    isToEnsFetching,
    toFieldError,
    simulateFrom,
    setSimulateFrom,
    simulateFromError,
    dataBytes,
    formError,
    sendError,
    canSimulate,
    isSimulating,
    onSimulate: handleSimulate,
    onClearTransaction: handleClearForm,
    onClearResults: () => {
      setLastTx(null);
      resetSimulationState();
    },
    canSend,
    isSending,
    onSend: handleSend,
  };

  // Dashboard Data Prep
  const simulationResult = simulation ?? undefined;
  const simulationLogs = simulationResult?.logs ?? [];
  const simulationTrace = simulationResult?.trace ?? [];
  const simulationStateChanges = simulationResult?.stateChanges ?? [];
  const simulationAssetChanges = simulationResult?.assetChanges ?? [];
  const simulationExposureChanges = simulationResult?.exposureChanges ?? [];
  const simulationBalanceChanges = simulationResult?.balanceChanges ?? [];
  const simulationGasUsedBi = hexToBigIntSafe(simulationResult?.gasUsed);
  const simulationAccessList = simulationResult?.generated_access_list ?? [];

  const resolveContractName = useMemo(() => {
    const byAddress = new Map<string, string>();
    const contracts = (simulationResult as any)?.contracts as
      | Array<{ address?: unknown; contract_name?: unknown }>
      | undefined;
    for (const c of contracts ?? []) {
      const addr =
        typeof c?.address === "string" ? c.address.toLowerCase() : undefined;
      const name =
        typeof c?.contract_name === "string" && c.contract_name.trim().length
          ? c.contract_name.trim()
          : undefined;
      if (addr && name) byAddress.set(addr, name);
    }

    return (address?: string) => {
      if (!address) return undefined;
      return byAddress.get(address.toLowerCase());
    };
  }, [simulationResult]);

  const actorAddress = useMemo(() => {
    if (typeof address === "string" && isAddress(address)) {
      return address;
    }
    const from = simulationTrace?.[0]?.from;
    if (typeof from === "string" && isAddress(from)) return from;
    return undefined;
  }, [address, simulationTrace]);

  const onConnect = (connector: any) => {
    resetSendState();
    resetSimulationState();
    connect({ connector });
  };

  const renderDashboardContent = () => {
    if (isSimulating && !simulation && !simulationError) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Running simulation...</p>
        </div>
      );
    }

    if (simulationError) {
      return (
        <div className="mx-auto max-w-2xl rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          <WarningCircleIcon weight="bold" className="mx-auto mb-2 h-6 w-6" />
          <p className="font-semibold">Simulation Failed</p>
          <p className="mt-1 opacity-90">{simulationError}</p>
        </div>
      );
    }

    if (!simulation) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground opacity-60">
          <div className="h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <p className="text-xs font-semibold uppercase tracking-widest">
            No simulation data
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView("new-transaction")}
          >
            Go to New Transaction
          </Button>
        </div>
      );
    }

    switch (activeView) {
      case "gas-overview":
        return (
          <GasView
            simulationTrace={simulationTrace}
            simulationGasUsedBi={simulationGasUsedBi}
            simulationStatus={simulationResult?.status}
            simulationErrorMessage={simulationResult?.errorMessage}
            chainId={chainId}
            resolveContractName={resolveContractName}
            generatedAccessList={simulationAccessList}
          />
        );
      case "state-assets":
        return (
          <AssetsView
            simulationAssetChanges={simulationAssetChanges}
            simulationExposureChanges={simulationExposureChanges}
            simulationBalanceChanges={simulationBalanceChanges}
            actorAddress={actorAddress}
            chainId={chainId}
            resolveContractName={resolveContractName}
          />
        );
      case "state-changes":
        return (
          <StateView
            simulationStateChanges={simulationStateChanges}
            chainId={chainId}
            resolveContractName={resolveContractName}
          />
        );
      case "state-logs":
        return (
          <EventsView
            simulationLogs={simulationLogs}
            chainId={chainId}
            resolveContractName={resolveContractName}
          />
        );
      default:
        return null;
    }
  };

  const isInputsView = (view: string) =>
    view === "new-transaction" ||
    view === "inputs-history" ||
    view === "inputs-custom" ||
    view === "inputs-json" ||
    view === "inputs-tenderly-id" ||
    view === "inputs-tx-hash";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isConnected={isConnected}
        address={address}
        ensName={walletDisplayName}
        ensAvatar={walletEnsAvatarQuery.data ?? undefined}
        connectors={connectors}
        onDisconnect={disconnect}
        onConnect={onConnect}
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <div className="mb-3">
            <SidebarTrigger className="h-8 w-8" />
          </div>
          <div className="mx-auto w-full max-w-7xl animate-in fade-in-0 duration-300">
            {isInputsView(activeView) ? (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                <div className="lg:sticky lg:top-20 space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">New Transaction</h2>
                    <p className="text-sm text-muted-foreground">
                      Compose and simulate transactions before executing.
                    </p>
                  </div>
                  <TransactionPanel {...transactionPanelProps} />
                </div>
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">
                      Recent Activity
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      History of your simulations and executions.
                    </p>
                  </div>
                  <HistoryDataTable
                    data={historyData}
                    onLoadHistoryItem={handleLoadHistoryItem}
                    onViewSimulation={handleViewSavedSimulation}
                    onResimulate={handleResimulateSavedSimulation}
                    onClearExecutions={() => setExecutionHistory([])}
                    ethPrice={ethPrice}
                  />
                </div>
              </div>
            ) : (
              <>
                {simulation && (
                  <div className="flex items-center justify-end gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      onClick={() => {
                        if (!simulationRequest) return;
                        navigator.clipboard.writeText(
                          JSON.stringify(simulationRequest, null, 2)
                        );
                        toast.success("Transaction JSON copied");
                      }}
                    >
                      <Copy className="size-3.5" />
                      Copy Tx JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      onClick={() => {
                        if (!simulation) return;
                        navigator.clipboard.writeText(
                          JSON.stringify(simulation, null, 2)
                        );
                        toast.success("Tenderly Output copied");
                      }}
                    >
                      <Copy className="size-3.5" />
                      Copy Tenderly JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      disabled={!tenderlyDashboardUrl}
                      onClick={() => {
                        if (!tenderlyDashboardUrl) return;
                        window.open(
                          tenderlyDashboardUrl,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      <ExternalLink className="size-3.5" />
                      View in Tenderly
                    </Button>
                  </div>
                )}
                {renderDashboardContent()}
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
