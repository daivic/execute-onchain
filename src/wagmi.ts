import { baseAccount, coinbaseWallet } from "wagmi/connectors";
import { createConfig, http } from "wagmi";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  zora,
} from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet, arbitrum, optimism, polygon, zora],
  connectors: [
    coinbaseWallet({
      appName: "Execute Onchain",
      preference: { options: "all", telemetry: false },
    }),
    baseAccount({
      appName: "Execute Onchain",
      appLogoUrl: null,
      preference: { options: "all", telemetry: false },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [zora.id]: http(),
  },
});
