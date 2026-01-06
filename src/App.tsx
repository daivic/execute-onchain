import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { createPublicClient, http, isAddress, parseEther, toHex } from "viem";
import { mainnet } from "viem/chains";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

const SUPPORTED_CHAINS = [base, baseSepolia] as const;
type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

const ENS_RPC_URL = "https://ethereum.publicnode.com";
const ensPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(ENS_RPC_URL),
});

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return SUPPORTED_CHAINS.some((c) => c.id === chainId);
}

function getChainLabel(chainId: number) {
  if (chainId === base.id) return "Base";
  if (chainId === baseSepolia.id) return "Base Sepolia";
  return `Chain ${chainId}`;
}

function getExplorerTxUrl(chainId: number, hash: string) {
  if (chainId === baseSepolia.id)
    return `https://sepolia.basescan.org/tx/${hash}`;
  return `https://basescan.org/tx/${hash}`;
}

function shortenHex(hex: string, left = 6, right = 4) {
  if (hex.length <= left + right + 2) return hex;
  return `${hex.slice(0, left + 2)}…${hex.slice(-right)}`;
}

function shortenString(str: string, left = 14, right = 10) {
  if (str.length <= left + right + 1) return str;
  return `${str.slice(0, left)}…${str.slice(-right)}`;
}

function formatIntString(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function hexToBigIntSafe(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function formatHexToDecimal(value: unknown) {
  const bi = hexToBigIntSafe(value);
  if (bi === undefined) return undefined;
  return formatIntString(bi.toString());
}

function toDisplayString(value: unknown, maxLen = 96) {
  if (value === undefined) return { display: "—" as const };
  if (value === null)
    return { display: "null" as const, title: "null" as const };

  if (typeof value === "string") {
    const title = value;
    if (/^\d+$/.test(value)) return { display: formatIntString(value), title };
    if (isAddress(value)) return { display: shortenHex(value), title };
    if (/^0x[0-9a-fA-F]+$/.test(value) && value.length > maxLen)
      return { display: shortenHex(value, 10, 10), title };
    if (value.length > maxLen)
      return { display: shortenString(value, 56, 18), title };
    return { display: value };
  }

  if (typeof value === "number") return { display: value.toLocaleString() };
  if (typeof value === "boolean") return { display: value ? "true" : "false" };
  if (typeof value === "bigint")
    return { display: formatIntString(value.toString()) };

  try {
    const title = JSON.stringify(value);
    if (title.length > maxLen)
      return { display: shortenString(title, 56, 18), title };
    return { display: title };
  } catch {
    return { display: String(value) };
  }
}

function sanitizeHexInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const noWhitespace = trimmed.replace(/\s+/g, "");

  if (noWhitespace.startsWith("0x") || noWhitespace.startsWith("0X")) {
    return `0x${noWhitespace.slice(2)}`;
  }

  // If user pastes hex without 0x prefix, normalize it.
  if (/^[0-9a-fA-F]+$/.test(noWhitespace)) return `0x${noWhitespace}`;

  return noWhitespace;
}

type TenderlyRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type TenderlyDecodedParam = {
  value?: unknown;
  type?: string;
  name?: string;
  indexed?: boolean;
};

type TenderlyLog = {
  name?: string;
  anonymous?: boolean;
  inputs?: TenderlyDecodedParam[];
  raw?: {
    address?: string;
    topics?: string[];
    data?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type TenderlyTraceEntry = {
  type?: string;
  from?: string;
  to?: string;
  gas?: Hex | string;
  gasUsed?: Hex | string;
  value?: Hex | string;
  input?: Hex | string;
  decodedInput?: TenderlyDecodedParam[];
  method?: string;
  output?: Hex | string;
  decodedOutput?: TenderlyDecodedParam[];
  subtraces?: number;
  traceAddress?: number[];
  [key: string]: unknown;
};

type TenderlyExposureChange = {
  type?: string;
  owner?: string;
  spender?: string;
  amount?: string;
  rawAmount?: Hex | string;
  dollarValue?: string;
  assetInfo?: {
    standard?: string;
    contractAddress?: string;
    symbol?: string;
    name?: string;
    decimals?: number;
    dollarValue?: string;
    logo?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type TenderlyStateChange = {
  address?: string;
  nonce?: { previousValue?: Hex | string; newValue?: Hex | string };
  storage?: Array<{
    slot?: Hex | string;
    previousValue?: Hex | string;
    newValue?: Hex | string;
  }>;
  balance?: { previousValue?: Hex | string; newValue?: Hex | string };
  [key: string]: unknown;
};

type TenderlySimulateResult = {
  status?: boolean;
  gasUsed?: Hex;
  cumulativeGasUsed?: Hex;
  blockNumber?: Hex;
  type?: Hex;
  logsBloom?: Hex;
  logs?: TenderlyLog[];
  trace?: TenderlyTraceEntry[];
  exposureChanges?: TenderlyExposureChange[];
  stateChanges?: TenderlyStateChange[];
  [key: string]: unknown;
};

type TenderlySimulateResponse = {
  id: number;
  jsonrpc: string;
  result?: TenderlySimulateResult;
  error?: TenderlyRpcError;
};

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const {
    connectors,
    connect,
    error: connectError,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();

  const {
    switchChain,
    error: switchError,
    isPending: isSwitching,
  } = useSwitchChain();

  const {
    sendTransaction,
    data: txHash,
    error: sendError,
    isPending: isSending,
    reset: resetSendState,
  } = useSendTransaction();

  const [targetChainId, setTargetChainId] = useState<SupportedChainId>(base.id);

  const [to, setTo] = useState("");
  const [calldata, setCalldata] = useState("0x");
  const [valueEth, setValueEth] = useState("");
  const [gasLimit, setGasLimit] = useState("");

  const [activeBubble, setActiveBubble] = useState<null | "wallet" | "target">(
    null
  );

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulation, setSimulation] = useState<TenderlySimulateResponse | null>(
    null
  );
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const resetSimulationState = () => {
    setSimulation(null);
    setSimulationError(null);
  };

  useEffect(() => {
    if (isSupportedChainId(chainId)) setTargetChainId(chainId);
  }, [chainId]);

  useEffect(() => {
    // Close the picker after a successful connect to keep the top bar compact.
    if (isConnected) setActiveBubble(null);
  }, [isConnected]);

  const selectedChain = useMemo(
    () => SUPPORTED_CHAINS.find((c) => c.id === targetChainId) ?? base,
    [targetChainId]
  );

  const isOnTargetChain = chainId === targetChainId;

  const toTrimmed = to.trim();
  const toIsValid = isAddress(toTrimmed);
  const toAddress = (toIsValid ? (toTrimmed as Address) : undefined) satisfies
    | Address
    | undefined;

  const walletEnsNameQuery = useQuery({
    queryKey: ["ensName", address ?? null],
    enabled: Boolean(address),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!address) return null;
      try {
        return await ensPublicClient.getEnsName({ address });
      } catch {
        return null;
      }
    },
  });
  const walletEnsName = walletEnsNameQuery.data ?? undefined;

  const toEnsNameQuery = useQuery({
    queryKey: ["ensName", toAddress ?? null],
    enabled: Boolean(toAddress),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!toAddress) return null;
      try {
        return await ensPublicClient.getEnsName({ address: toAddress });
      } catch {
        return null;
      }
    },
  });
  const toEnsName = toEnsNameQuery.data ?? undefined;

  const dataTrimmed = calldata.trim();
  const dataLooksHex = /^0x[0-9a-fA-F]*$/.test(dataTrimmed);
  const dataEvenLength = dataTrimmed.length % 2 === 0;
  const dataIsValid = dataLooksHex && dataEvenLength;
  const dataHex = (dataIsValid ? (dataTrimmed as Hex) : undefined) satisfies
    | Hex
    | undefined;

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

  const formError = !toTrimmed
    ? "Enter a destination address."
    : !toIsValid
    ? "Destination address is not a valid 0x address."
    : !dataTrimmed
    ? "Enter calldata."
    : !dataLooksHex
    ? "Calldata must be hex (0x...)."
    : !dataEvenLength
    ? "Calldata hex length must be even."
    : valueError
    ? valueError
    : gasError
    ? gasError
    : undefined;

  const canSend =
    isConnected && isOnTargetChain && !formError && !isSending && !isSwitching;

  const tenderlySupported = targetChainId === base.id;
  const canSimulate =
    isConnected &&
    !!address &&
    tenderlySupported &&
    !formError &&
    !isSimulating &&
    !isSwitching;

  const simulationResult = simulation?.result;
  const simulationLogs = simulationResult?.logs ?? [];
  const simulationTrace = simulationResult?.trace ?? [];
  const simulationExposureChanges = simulationResult?.exposureChanges ?? [];
  const simulationStateChanges = simulationResult?.stateChanges ?? [];

  const simulationStatus =
    typeof simulationResult?.status === "boolean"
      ? simulationResult.status
      : undefined;
  const simulationGasUsed = simulationResult?.gasUsed;
  const simulationBlockNumber = simulationResult?.blockNumber;
  const simulationGasUsedDec = formatHexToDecimal(simulationGasUsed);
  const simulationBlockNumberDec = formatHexToDecimal(simulationBlockNumber);
  const simulationGasUsedBi = hexToBigIntSafe(simulationGasUsed);

  const walletDotClass = isConnected
    ? "dotOk"
    : isConnecting
    ? "dotInfo"
    : "dotOff";
  const chainDotClass = !isConnected
    ? "dotOff"
    : isOnTargetChain
    ? "dotOk"
    : "dotWarn";
  const simDotClass = isSimulating
    ? "dotInfo"
    : simulationStatus === true
    ? "dotOk"
    : simulationStatus === false
    ? "dotBad"
    : tenderlySupported
    ? "dotPurple"
    : "dotOff";

  const traceRows = useMemo(() => {
    const totalGas = simulationGasUsedBi ?? 0n;

    const rows = simulationTrace.map((entry, index) => {
      const gasUsedBi = hexToBigIntSafe(entry.gasUsed) ?? 0n;
      const depth = Array.isArray(entry.traceAddress)
        ? entry.traceAddress.length
        : 0;

      const methodLabel =
        entry.method ?? (entry.type ? String(entry.type) : "CALL");

      const toLabel =
        typeof entry.to === "string" && isAddress(entry.to)
          ? shortenHex(entry.to)
          : typeof entry.to === "string"
          ? shortenString(entry.to, 10, 8)
          : "—";

      const toTitle = typeof entry.to === "string" ? entry.to : undefined;

      const gasUsedDec = formatIntString(gasUsedBi.toString());

      const percent =
        totalGas > 0n
          ? (() => {
              const basisPoints = (gasUsedBi * 10000n) / totalGas;
              const whole = basisPoints / 100n;
              const frac = basisPoints % 100n;
              return `${whole.toString()}.${frac.toString().padStart(2, "0")}%`;
            })()
          : "—";

      return {
        index,
        depth,
        entry,
        methodLabel,
        toLabel,
        toTitle,
        gasUsedBi,
        gasUsedDec,
        percent,
      };
    });

    rows.sort((a, b) => {
      if (a.gasUsedBi === b.gasUsedBi) return a.index - b.index;
      return a.gasUsedBi < b.gasUsedBi ? 1 : -1;
    });

    return { totalGas, rows };
  }, [simulationGasUsedBi, simulationTrace]);

  return (
    <div className="page">
      <div className="container">
        <div className="bubbleBar">
          <div className="bubble bubbleLogo" title="Base">
            <img
              className="baseLogoImg"
              src={`${import.meta.env.BASE_URL}base-logo-square.svg`}
              alt="Base"
            />
          </div>

          <button
            className={`bubble bubbleButton ${
              activeBubble === "wallet" ? "bubbleActive" : ""
            }`}
            type="button"
            title={
              address
                ? walletEnsName
                  ? `${walletEnsName} · ${address}`
                  : address
                : "Connect a wallet"
            }
            onClick={() =>
              setActiveBubble((v) => (v === "wallet" ? null : "wallet"))
            }
          >
            <span className={`dot ${walletDotClass}`} />
            <span className="bubbleLabel">Wallet</span>
            <span className="bubbleValue mono">
              {walletEnsName ?? (address ? shortenHex(address) : "—")}
            </span>
            <span className="bubbleIcon">▾</span>
          </button>

          <button
            className={`bubble bubbleButton ${
              !isConnected ? "bubbleDisabled" : ""
            }`}
            type="button"
            disabled={!isConnected || isSwitching}
            title={
              !isConnected
                ? "Connect wallet to view/switch chain"
                : isOnTargetChain
                ? "Wallet chain matches target"
                : `Click to switch wallet to ${selectedChain.name}`
            }
            onClick={() => {
              if (!isConnected) return;
              if (!isOnTargetChain) switchChain({ chainId: targetChainId });
            }}
          >
            <span className={`dot ${chainDotClass}`} />
            <span className="bubbleLabel">Chain</span>
            <span className="bubbleValue">
              {isConnected ? getChainLabel(chainId) : "—"}
            </span>
            {!isOnTargetChain && isConnected ? (
              <span className="bubbleIcon">{isSwitching ? "…" : "⇄"}</span>
            ) : null}
          </button>

          <button
            className={`bubble bubbleButton ${
              activeBubble === "target" ? "bubbleActive" : ""
            }`}
            type="button"
            title="Select target chain"
            onClick={() =>
              setActiveBubble((v) => (v === "target" ? null : "target"))
            }
          >
            <span
              className={`dot ${tenderlySupported ? "dotPurple" : "dotOff"}`}
            />
            <span className="bubbleLabel">Target</span>
            <span className="bubbleValue">{selectedChain.name}</span>
            <span className="bubbleIcon">▾</span>
          </button>

          <div
            className="bubble"
            title="Tenderly simulation (dot = last result)"
          >
            <span className={`dot ${simDotClass}`} />
            <span className="bubbleLabel">Sim</span>
            <span className="bubbleValue mono">
              {tenderlySupported ? "T" : "—"}
            </span>
          </div>
        </div>

        {activeBubble ? (
          <div className="bubblePanel">
            {activeBubble === "wallet" ? (
              isConnected ? (
                <div className="bubblePanelInner">
                  <div className="kv">
                    <span className="k">Account</span>
                    <span className="v mono" title={address}>
                      {walletEnsName ?? (address ? shortenHex(address) : "—")}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">Chain</span>
                    <span className="v">{getChainLabel(chainId)}</span>
                  </div>
                  <div className="buttonRow">
                    <button
                      className="button buttonSecondary"
                      type="button"
                      onClick={async () => {
                        if (!address) return;
                        try {
                          await navigator.clipboard.writeText(address);
                        } catch {
                          // noop
                        }
                      }}
                    >
                      Copy address
                    </button>
                    <button
                      className="button buttonSecondary"
                      type="button"
                      onClick={() => {
                        resetSendState();
                        resetSimulationState();
                        disconnect();
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="buttonRow">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      className="button"
                      onClick={() => {
                        resetSendState();
                        resetSimulationState();
                        connect({ connector });
                      }}
                      disabled={isConnecting}
                      type="button"
                    >
                      {isConnecting
                        ? "Connecting…"
                        : `Connect ${connector.name}`}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="buttonRow">
                {SUPPORTED_CHAINS.map((c) => (
                  <button
                    key={c.id}
                    className={`button ${
                      targetChainId === c.id
                        ? "buttonTenderly"
                        : "buttonSecondary"
                    }`}
                    type="button"
                    onClick={() => {
                      setTargetChainId(c.id);
                      setActiveBubble(null);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {connectError ? (
          <p className="error">Connect failed: {connectError.message}</p>
        ) : null}
        {switchError ? (
          <p className="error">Switch failed: {switchError.message}</p>
        ) : null}

        <section className="card">
          <div className="cardHeader">
            <h2>Transaction</h2>
          </div>

          <div className="grid">
            <label className="field">
              <span className="label">To</span>
              <input
                className="input mono"
                placeholder="0x…"
                value={to}
                onChange={(e) => {
                  resetSendState();
                  resetSimulationState();
                  setTo(e.target.value);
                }}
              />
              {toAddress ? (
                <div className="metaRow">
                  <span className="meta">
                    ENS:{" "}
                    {toEnsNameQuery.isFetching
                      ? "resolving…"
                      : toEnsName ?? "—"}
                  </span>
                </div>
              ) : null}
            </label>

            <label className="field">
              <span className="label">Value (ETH)</span>
              <input
                className="input mono"
                placeholder="0 (optional)"
                value={valueEth}
                onChange={(e) => {
                  resetSendState();
                  resetSimulationState();
                  setValueEth(e.target.value);
                }}
              />
            </label>

            <label className="field fieldFull">
              <span className="label">
                Calldata <span className="hint">(hex)</span>
              </span>
              <textarea
                className="input mono textarea"
                placeholder="0x…"
                value={calldata}
                onChange={(e) => {
                  resetSendState();
                  resetSimulationState();
                  setCalldata(sanitizeHexInput(e.target.value));
                }}
                rows={6}
              />
              <div className="metaRow">
                <span className="meta">{dataBytes} bytes</span>
                {dataTrimmed === "0x" ? (
                  <span className="meta warn">Note: 0x means no calldata.</span>
                ) : null}
              </div>
            </label>

            <label className="field">
              <span className="label">
                Gas limit <span className="hint">(optional)</span>
              </span>
              <input
                className="input mono"
                placeholder="e.g. 250000"
                value={gasLimit}
                onChange={(e) => {
                  resetSendState();
                  resetSimulationState();
                  setGasLimit(e.target.value);
                }}
              />
            </label>
          </div>

          {formError ? <p className="error">{formError}</p> : null}

          {!isOnTargetChain && isConnected ? (
            <p className="error">
              Wrong network. Switch your wallet to{" "}
              <strong>{selectedChain.name}</strong> to send.
            </p>
          ) : null}

          <div className="buttonRow">
            <button
              className="button buttonPrimary"
              disabled={!canSend}
              type="button"
              onClick={() => {
                if (!toAddress || !dataHex || valueWei === undefined) return;
                resetSendState();
                sendTransaction({
                  to: toAddress,
                  data: dataHex,
                  value: valueWei,
                  gas: gasWei,
                });
              }}
            >
              {isSending ? "Sending…" : "Send transaction"}
            </button>

            <button
              className="button buttonTenderly"
              disabled={!canSimulate}
              type="button"
              onClick={async () => {
                if (
                  !address ||
                  !toAddress ||
                  !dataHex ||
                  valueWei === undefined
                )
                  return;

                resetSimulationState();
                setIsSimulating(true);

                try {
                  const gasForSim = gasWei ?? 30_000_000n;
                  const payload = {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tenderly_simulateTransaction",
                    params: [
                      {
                        from: address,
                        to: toAddress,
                        data: dataHex,
                        value: toHex(valueWei),
                        gas: toHex(gasForSim),
                      },
                      "latest",
                    ],
                  };

                  const response = await fetch("/tenderly-base", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (response.status === 404) {
                    throw new Error(
                      "Tenderly proxy endpoint (/tenderly-base) not found. Restart the dev server with TENDERLY_BASE_RPC_URL set (proxy works in `npm run dev`, not `npm run preview`)."
                    );
                  }

                  const text = await response.text();
                  let json: TenderlySimulateResponse;
                  try {
                    json = JSON.parse(text) as TenderlySimulateResponse;
                  } catch {
                    throw new Error(
                      `Tenderly returned a non-JSON response (HTTP ${response.status}).`
                    );
                  }

                  if (!response.ok) {
                    throw new Error(
                      `Tenderly request failed (HTTP ${response.status}).`
                    );
                  }

                  if (json.error) {
                    throw new Error(json.error.message || "Tenderly error");
                  }

                  setSimulation(json);
                } catch (e) {
                  const message =
                    e instanceof Error
                      ? e.message
                      : "Simulation failed (unknown error).";

                  setSimulationError(
                    `${message} If you see a 404, start dev server with TENDERLY_BASE_RPC_URL set (see README).`
                  );
                } finally {
                  setIsSimulating(false);
                }
              }}
            >
              {isSimulating ? "Simulating…" : "Simulate (Tenderly)"}
            </button>

            <button
              className="button buttonSecondary"
              type="button"
              onClick={() => {
                resetSendState();
                resetSimulationState();
                setTo("");
                setValueEth("");
                setGasLimit("");
                setCalldata("0x");
              }}
            >
              Clear
            </button>
          </div>

          {!tenderlySupported ? (
            <p className="error">
              Tenderly simulation is currently configured for{" "}
              <strong>Base</strong> only. Switch target chain to Base to
              simulate.
            </p>
          ) : null}

          {sendError ? (
            <p className="error">Send failed: {sendError.message}</p>
          ) : null}

          {simulationError ? (
            <p className="error">Simulation failed: {simulationError}</p>
          ) : null}

          {txHash ? (
            <div className="successBox">
              <div className="kv">
                <span className="k">Tx hash</span>
                <span className="v mono">{shortenHex(txHash)}</span>
              </div>
              <a
                className="link"
                href={getExplorerTxUrl(targetChainId, txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View on Basescan
              </a>
            </div>
          ) : null}

          {simulation ? (
            <>
              <div className="successBox">
                <div>
                  <div className="kv">
                    <span className="k">Sim</span>
                    <span
                      className={
                        simulationStatus === undefined
                          ? "badge"
                          : simulationStatus
                          ? "badge badgeOk"
                          : "badge badgeBad"
                      }
                    >
                      {simulationStatus === undefined
                        ? "unknown"
                        : simulationStatus
                        ? "success"
                        : "reverted"}
                    </span>
                  </div>

                  <div className="kv">
                    <span className="k">Gas</span>
                    <span className="v mono">
                      {simulationGasUsedDec
                        ? `${simulationGasUsedDec} (${simulationGasUsed})`
                        : simulationGasUsed ?? "—"}
                    </span>
                  </div>

                  <div className="kv">
                    <span className="k">Block</span>
                    <span className="v mono">
                      {simulationBlockNumberDec
                        ? `${simulationBlockNumberDec} (${simulationBlockNumber})`
                        : simulationBlockNumber ?? "—"}
                    </span>
                  </div>

                  <div className="kv">
                    <span className="k">Logs</span>
                    <span className="v">{simulationLogs.length}</span>
                  </div>

                  <div className="kv">
                    <span className="k">Calls</span>
                    <span className="v">{simulationTrace.length}</span>
                  </div>

                  {simulationExposureChanges.length ? (
                    <div className="kv">
                      <span className="k">Exposure</span>
                      <span className="v">
                        {simulationExposureChanges.length}
                      </span>
                    </div>
                  ) : null}

                  <div className="kv">
                    <span className="k">State</span>
                    <span className="v">{simulationStateChanges.length}</span>
                  </div>
                </div>

                <div className="buttonRow">
                  <button
                    className="button buttonSecondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          JSON.stringify(simulation, null, 2)
                        );
                      } catch {
                        // noop (clipboard may be blocked)
                      }
                    }}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="button buttonSecondary"
                    type="button"
                    onClick={() => resetSimulationState()}
                  >
                    Clear sim
                  </button>
                </div>
              </div>

              <details className="details" open>
                <summary className="detailsSummary">
                  Gas profiling{" "}
                  <span className="detailsMeta">
                    {simulationGasUsedBi
                      ? `total ${formatIntString(
                          simulationGasUsedBi.toString()
                        )}`
                      : "total —"}
                  </span>
                </summary>
                <div className="detailsBody">
                  {traceRows.rows.length ? (
                    <div className="tableWrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Depth</th>
                            <th>Method</th>
                            <th>To</th>
                            <th className="rightCell">Gas used</th>
                            <th className="rightCell">% total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {traceRows.rows.slice(0, 25).map((row, i) => (
                            <tr key={row.index}>
                              <td className="mono faintCell">{i + 1}</td>
                              <td className="mono faintCell">{row.depth}</td>
                              <td className="mono">
                                <details className="detailsInline">
                                  <summary className="detailsInlineSummary">
                                    {row.methodLabel}
                                  </summary>
                                  <div className="detailsInlineBody">
                                    <div className="kv">
                                      <span className="k">From</span>
                                      <span className="v mono">
                                        {typeof row.entry.from === "string" &&
                                        isAddress(row.entry.from)
                                          ? shortenHex(row.entry.from)
                                          : typeof row.entry.from === "string"
                                          ? shortenString(row.entry.from, 16, 8)
                                          : "—"}
                                      </span>
                                    </div>
                                    <div className="kv">
                                      <span className="k">To</span>
                                      <span
                                        className="v mono"
                                        title={row.toTitle}
                                      >
                                        {row.toTitle && isAddress(row.toTitle)
                                          ? shortenHex(row.toTitle)
                                          : row.toLabel}
                                      </span>
                                    </div>
                                    <div className="kv">
                                      <span className="k">Gas</span>
                                      <span className="v mono">
                                        {formatHexToDecimal(row.entry.gas) ??
                                          toDisplayString(row.entry.gas)
                                            .display}
                                      </span>
                                    </div>
                                    <div className="kv">
                                      <span className="k">Gas used</span>
                                      <span className="v mono">
                                        {row.gasUsedDec} (
                                        {String(row.entry.gasUsed ?? "—")})
                                      </span>
                                    </div>
                                    <div className="kv">
                                      <span className="k">Value</span>
                                      <span className="v mono">
                                        {formatHexToDecimal(row.entry.value) ??
                                          toDisplayString(row.entry.value)
                                            .display}
                                      </span>
                                    </div>
                                    {row.entry.decodedInput?.length ? (
                                      <div className="tableWrap">
                                        <table className="table tableCompact">
                                          <thead>
                                            <tr>
                                              <th>Arg</th>
                                              <th>Type</th>
                                              <th>Value</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.entry.decodedInput.map(
                                              (p, pi) => {
                                                const v = toDisplayString(
                                                  p.value
                                                );
                                                return (
                                                  <tr key={pi}>
                                                    <td className="mono">
                                                      {p.name ?? `arg${pi}`}
                                                    </td>
                                                    <td className="mono faintCell">
                                                      {p.type ?? "—"}
                                                    </td>
                                                    <td
                                                      className="mono"
                                                      title={v.title}
                                                    >
                                                      {v.display}
                                                    </td>
                                                  </tr>
                                                );
                                              }
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : null}
                                    <details className="details detailsInner">
                                      <summary className="detailsSummary">
                                        Raw call
                                      </summary>
                                      <div className="detailsBody">
                                        <pre className="codeBlock mono">
                                          {JSON.stringify(row.entry, null, 2)}
                                        </pre>
                                      </div>
                                    </details>
                                  </div>
                                </details>
                              </td>
                              <td className="mono" title={row.toTitle}>
                                {row.toLabel}
                              </td>
                              <td className="mono rightCell">
                                {row.gasUsedDec}
                              </td>
                              <td className="mono rightCell">{row.percent}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {traceRows.rows.length > 25 ? (
                        <p className="meta">
                          Showing top 25 calls by gas used (of{" "}
                          {traceRows.rows.length}).
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="meta">No trace returned.</p>
                  )}
                </div>
              </details>

              <details className="details" open>
                <summary className="detailsSummary">
                  Event logs{" "}
                  <span className="detailsMeta">{simulationLogs.length}</span>
                </summary>
                <div className="detailsBody">
                  {simulationLogs.length ? (
                    <div className="stack">
                      {simulationLogs.map((log, i) => {
                        const addr = log.raw?.address;
                        const addrDisplay =
                          typeof addr === "string" && isAddress(addr)
                            ? shortenHex(addr)
                            : typeof addr === "string"
                            ? shortenString(addr, 10, 8)
                            : "—";

                        return (
                          <details className="details detailsInner" key={i}>
                            <summary className="detailsSummary">
                              <span className="mono">
                                {log.name ?? `Log ${i + 1}`}
                              </span>{" "}
                              <span className="detailsMeta" title={addr}>
                                {addrDisplay}
                              </span>
                            </summary>
                            <div className="detailsBody">
                              {log.inputs?.length ? (
                                <div className="tableWrap">
                                  <table className="table tableCompact">
                                    <thead>
                                      <tr>
                                        <th>Param</th>
                                        <th>Type</th>
                                        <th>Value</th>
                                        <th>Indexed</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {log.inputs.map((p, pi) => {
                                        const v = toDisplayString(p.value);
                                        return (
                                          <tr key={pi}>
                                            <td className="mono">
                                              {p.name ?? `arg${pi}`}
                                            </td>
                                            <td className="mono faintCell">
                                              {p.type ?? "—"}
                                            </td>
                                            <td
                                              className="mono"
                                              title={v.title}
                                            >
                                              {v.display}
                                            </td>
                                            <td className="mono faintCell">
                                              {p.indexed ? "true" : "false"}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="meta">No decoded inputs.</p>
                              )}

                              <details className="details detailsInner">
                                <summary className="detailsSummary">
                                  Raw log
                                </summary>
                                <div className="detailsBody">
                                  <pre className="codeBlock mono">
                                    {JSON.stringify(log, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="meta">No logs emitted.</p>
                  )}
                </div>
              </details>

              {simulationExposureChanges.length ? (
                <details className="details">
                  <summary className="detailsSummary">
                    Exposure changes{" "}
                    <span className="detailsMeta">
                      {simulationExposureChanges.length}
                    </span>
                  </summary>
                  <div className="detailsBody">
                    <div className="tableWrap">
                      <table className="table tableCompact">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Asset</th>
                            <th>Owner</th>
                            <th>Spender</th>
                            <th className="rightCell">Amount</th>
                            <th className="rightCell">$</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulationExposureChanges.map((c, i) => {
                            const owner = toDisplayString(c.owner);
                            const spender = toDisplayString(c.spender);
                            return (
                              <tr key={i}>
                                <td className="mono">{c.type ?? "—"}</td>
                                <td className="mono">
                                  {c.assetInfo?.symbol ?? "—"}
                                </td>
                                <td className="mono" title={owner.title}>
                                  {owner.display}
                                </td>
                                <td className="mono" title={spender.title}>
                                  {spender.display}
                                </td>
                                <td className="mono rightCell">
                                  {c.amount ?? "—"}
                                </td>
                                <td className="mono rightCell">
                                  {c.dollarValue ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ) : null}

              <details className="details">
                <summary className="detailsSummary">
                  State changes{" "}
                  <span className="detailsMeta">
                    {simulationStateChanges.length}
                  </span>
                </summary>
                <div className="detailsBody">
                  {simulationStateChanges.length ? (
                    <div className="stack">
                      {simulationStateChanges.map((c, i) => {
                        const addr = c.address;
                        const addrDisplay =
                          typeof addr === "string" && isAddress(addr)
                            ? shortenHex(addr)
                            : typeof addr === "string"
                            ? shortenString(addr, 10, 8)
                            : "—";

                        const storageCount = c.storage?.length ?? 0;
                        const nonceFrom = c.nonce?.previousValue;
                        const nonceTo = c.nonce?.newValue;

                        return (
                          <details className="details detailsInner" key={i}>
                            <summary className="detailsSummary" title={addr}>
                              <span className="mono">{addrDisplay}</span>{" "}
                              <span className="detailsMeta">
                                {storageCount
                                  ? `${storageCount} storage`
                                  : "no storage"}
                                {nonceFrom && nonceTo ? " · nonce" : ""}
                              </span>
                            </summary>
                            <div className="detailsBody">
                              {nonceFrom && nonceTo ? (
                                <div className="kv">
                                  <span className="k">Nonce</span>
                                  <span className="v mono">
                                    {formatHexToDecimal(nonceFrom) ??
                                      String(nonceFrom)}{" "}
                                    →{" "}
                                    {formatHexToDecimal(nonceTo) ??
                                      String(nonceTo)}
                                  </span>
                                </div>
                              ) : null}

                              {c.storage?.length ? (
                                <div className="tableWrap">
                                  <table className="table tableCompact">
                                    <thead>
                                      <tr>
                                        <th>Slot</th>
                                        <th>Previous</th>
                                        <th>New</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.storage.map((s, si) => {
                                        const slot = toDisplayString(
                                          s.slot,
                                          80
                                        );
                                        const prev = toDisplayString(
                                          s.previousValue,
                                          80
                                        );
                                        const next = toDisplayString(
                                          s.newValue,
                                          80
                                        );
                                        return (
                                          <tr key={si}>
                                            <td
                                              className="mono"
                                              title={slot.title}
                                            >
                                              {slot.display}
                                            </td>
                                            <td
                                              className="mono"
                                              title={prev.title}
                                            >
                                              {prev.display}
                                            </td>
                                            <td
                                              className="mono"
                                              title={next.title}
                                            >
                                              {next.display}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="meta">No storage changes.</p>
                              )}

                              <details className="details detailsInner">
                                <summary className="detailsSummary">
                                  Raw change
                                </summary>
                                <div className="detailsBody">
                                  <pre className="codeBlock mono">
                                    {JSON.stringify(c, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="meta">No state changes returned.</p>
                  )}
                </div>
              </details>

              <details className="details">
                <summary className="detailsSummary">
                  Raw simulation JSON
                </summary>
                <div className="detailsBody">
                  <pre className="codeBlock mono">
                    {JSON.stringify(simulation, null, 2)}
                  </pre>
                </div>
              </details>
            </>
          ) : null}
        </section>

        <footer className="footer">
          <p className="fineprint">
            Safety: this sends raw calldata. Always verify the{" "}
            <span className="mono">to</span> address, calldata, and value before
            confirming in your wallet.
          </p>
        </footer>
      </div>
    </div>
  );
}
