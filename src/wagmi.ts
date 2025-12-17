import { baseAccount, coinbaseWallet, injected } from 'wagmi/connectors'
import { createConfig, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    baseAccount({
      appName: 'Execute Onchain',
      appLogoUrl: null,
      preference: { telemetry: false },
    }),
    coinbaseWallet({
      appName: 'Execute Onchain',
    }),
    injected(),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})


