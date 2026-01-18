import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["TENDERLY_"]);
  const tenderlyBaseRpcUrl = (
    process.env.TENDERLY_BASE_RPC_URL ?? env.TENDERLY_BASE_RPC_URL
  )?.trim();

  const tenderlyAccessKey = (
    process.env.TENDERLY_ACCESS_KEY ?? env.TENDERLY_ACCESS_KEY
  )?.trim();
  const tenderlyAccountSlug = (
    process.env.TENDERLY_ACCOUNT_SLUG ?? env.TENDERLY_ACCOUNT_SLUG
  )?.trim();
  const tenderlyProjectSlug = (
    process.env.TENDERLY_PROJECT_SLUG ?? env.TENDERLY_PROJECT_SLUG
  )?.trim();

  const normalizeBasePath = (value: string | undefined) => {
    if (!value) return "/";
    const trimmed = value.trim();
    if (!trimmed) return "/";
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
  };

  const base = normalizeBasePath(process.env.BASE_PATH);
  const outDir = process.env.OUT_DIR?.trim();

  const proxy: Record<string, any> = {};
  if (tenderlyBaseRpcUrl) {
    const url = new URL(tenderlyBaseRpcUrl);
    proxy["/tenderly-base"] = {
      target: url.origin,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => path.replace(/^\/tenderly-base/, url.pathname),
    };
  }

  // Tenderly Simulation API (saved simulations, listing, fetch by ID).
  // Proxied through Vite dev server so the browser doesn't see X-Access-Key.
  if (tenderlyAccessKey && tenderlyAccountSlug && tenderlyProjectSlug) {
    const basePath = `/api/v1/account/${tenderlyAccountSlug}/project/${tenderlyProjectSlug}`;
    proxy["/tenderly-api"] = {
      target: "https://api.tenderly.co",
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => path.replace(/^\/tenderly-api/, basePath),
      configure: (proxyServer: any) => {
        proxyServer.on("proxyReq", (proxyReq: any) => {
          proxyReq.setHeader("X-Access-Key", tenderlyAccessKey);
        });
      },
    };
  }

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: outDir
      ? {
          outDir,
          emptyOutDir: true,
        }
      : undefined,
    server: {
      proxy,
    },
  };
});


