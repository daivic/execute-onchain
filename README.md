# Execute Onchain

Tiny local tool to **paste raw calldata** and submit a transaction from your wallet on **Base**.

## Quick start

```bash
cd /Users/daivicvora/Downloads/personal/execute-onchain
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Using it

1. **Connect wallet** (Base Account uses the **Base Account** connector; Coinbase Wallet + most browser wallets work via **Injected**).
2. Pick **Base** or **Base Sepolia**, and switch your wallet network if prompted.
3. Paste:
   - **To**: contract address
   - **Calldata**: `0x...`
   - Optional **Value (ETH)** and **Gas limit**
4. Click **Send transaction** → confirm in wallet.

## Tenderly simulation

The UI has a **Simulate (Tenderly)** button that calls Tenderly Gateway via a local Vite dev proxy.

Run the dev server with the gateway URL set:

```bash
TENDERLY_BASE_RPC_URL="https://base.gateway.tenderly.co/2KIuvXWOTbm2w0ijKVprJ" npm run dev
```

Notes:

- The provided gateway URL is for **Base mainnet** (simulation is disabled if you select Base Sepolia).
- If you prefer, you can also put that env var into an `.env.local` file (not committed).

## Deployment

This app is intended to be served at **`/execute/`** on `daivic.com`.

It’s deployed by the **`daivic-web`** GitHub Pages workflow, which builds this repo and publishes it into the main site’s `dist/execute/` directory.

## Safety notes

- This sends **raw calldata**. Double-check the `to` address + `data` + `value` before confirming.
- Prefer testing on **Base Sepolia** first if you’re unsure.
