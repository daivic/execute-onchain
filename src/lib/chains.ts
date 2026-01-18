import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  zora,
} from "wagmi/chains";

export const SUPPORTED_CHAINS = [
  base,
  baseSepolia,
  mainnet,
  arbitrum,
  optimism,
  polygon,
  zora,
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

export function isSupportedChainId(
  chainId: number
): chainId is SupportedChainId {
  return SUPPORTED_CHAINS.some((c) => c.id === chainId);
}

export function getChainLabel(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return chain?.name ?? `Chain ${chainId}`;
}

export function getExplorerTxUrl(chainId: number, hash: string) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain?.blockExplorers?.default?.url) {
    return `https://etherscan.io/tx/${hash}`;
  }
  return `${chain.blockExplorers.default.url}/tx/${hash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain?.blockExplorers?.default?.url) {
    return `https://etherscan.io/address/${address}`;
  }
  return `${chain.blockExplorers.default.url}/address/${address}`;
}

export function getExplorerName(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return chain?.blockExplorers?.default?.name ?? "Explorer";
}
export function getExplorerIcon(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain?.blockExplorers?.default?.url) {
    return "https://etherscan.io/favicon.ico";
  }
  return `${chain.blockExplorers.default.url}/favicon.ico`;
}
