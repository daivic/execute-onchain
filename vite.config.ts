import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["TENDERLY_"]);
  const tenderlyBaseRpcUrl = (
    process.env.TENDERLY_BASE_RPC_URL ?? env.TENDERLY_BASE_RPC_URL
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

  return {
    base,
    plugins: [react()],
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


