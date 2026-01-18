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

The UI has a **Simulate (Tenderly)** button that uses Tenderly's **Simulation API** in **full** mode and saves simulations so they show up in your Tenderly dashboard and in the app's **Recent Activity** list.

Run the dev server with Tenderly credentials set (recommended via `.env.local`, not committed):

```bash
TENDERLY_ACCESS_KEY="..." \
TENDERLY_ACCOUNT_SLUG="..." \
TENDERLY_PROJECT_SLUG="..." \
npm run dev
```

Notes:

- The app currently simulates only when you're on **Base mainnet**.
- These env vars are used only by the **Vite dev server proxy** (`/tenderly-api/*`), so the browser never sees your `X-Access-Key`.
- If you deploy this as a static site, you'll need your own backend/proxy to call Tenderly's API securely.

## Deployment

This app is intended to be served at **`/execute/`** on `daivic.com` (deployed by `daivic-web`).

It can also be deployed as a standalone project pages site at `https://daivic.github.io/execute-onchain/` via:

```bash
npm install
npm run deploy
```

## Safety notes

- This sends **raw calldata**. Double-check the `to` address + `data` + `value` before confirming.
- Prefer testing on **Base Sepolia** first if you’re unsure.
