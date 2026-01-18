import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { mainnet } from "wagmi/chains";

export const ENS_RPCS = [
  "https://cloudflare-eth.com",
  "https://rpc.ankr.com/eth",
  "https://ethereum.publicnode.com",
];

const ensClients = ENS_RPCS.map((url) => ({
  url,
  client: createPublicClient({
    chain: mainnet,
    // Disable batch to avoid gateways some public RPCs reject.
    transport: http(url, { batch: false }),
  }),
}));

interface UseEnsNameOptions {
  enabled?: boolean;
  /** Enable console logging for debugging. */
  log?: boolean;
}

export function useEnsName(address?: string, options?: UseEnsNameOptions) {
  const lower = useMemo(() => address?.toLowerCase(), [address]);
  const isAddressLike = isAddress(address ?? "", { strict: false });
  const enabled = Boolean(options?.enabled ?? true) && isAddressLike;
  const log = options?.log ?? true;

  return useQuery({
    queryKey: ["ensName", enabled ? lower : null],
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!address) return null;
      let lastError: unknown;
      for (const { client, url } of ensClients) {
        try {
          const name = await client.getEnsName({
            address: address as Address,
          });
          if (log) {
            console.info("[ens] ENS name lookup succeeded", {
              address,
              rpc: url,
            });
          }
          return name;
        } catch (err) {
          lastError = err;
          if (log) {
            console.warn("[ens] ENS name lookup failed on RPC", {
              address,
              rpc: url,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      throw lastError ?? new Error("ENS lookup failed on all RPCs");
    },
  });
}

