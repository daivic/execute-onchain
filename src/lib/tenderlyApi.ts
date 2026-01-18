import type {
  TenderlyAssetChange,
  TenderlyBalanceChange,
  TenderlyDecodedParam,
  TenderlyExposureChange,
  TenderlyLog,
  TenderlySimulateResult,
  TenderlyStateChange,
  TenderlyTraceEntry,
} from "@/lib/tenderly";

/**
 * Tenderly Simulation API client.
 *
 * This talks to `/tenderly-api/*`, which should be proxied by Vite dev server to:
 * `https://api.tenderly.co/api/v1/account/{account_slug}/project/{project_slug}/*`
 *
 * See:
 * - https://docs.tenderly.co/simulations/simulation-modes
 * - https://docs.tenderly.co/reference/api#/operations/getSimulatedTransactions
 * - https://docs.tenderly.co/reference/api#/operations/getSimulatedTransactionById
 */

export type TenderlySimulationType = "full" | "quick" | "abi";

export type TenderlySimulateApiRequest = {
  /** Persist the simulation in Tenderly dashboard so we can list/fetch it later. */
  save: boolean;
  /** Persist reverting simulations as well. */
  save_if_fails?: boolean;
  /** Controls how much decoded data is returned. */
  simulation_type?: TenderlySimulationType;
  /** EVM network id as string (e.g. Base mainnet is "8453"). */
  network_id: string;
  /** Sender address. */
  from: string;
  /** Recipient address. */
  to: string;
  /** Calldata/input. */
  input: string;
  /** Gas limit. */
  gas?: number;
  /**
   * Value in wei.
   * Use string to avoid precision loss for large values.
   */
  value?: string | number;
  [key: string]: unknown;
};

/**
 * The Tenderly API returns different shapes depending on endpoint and simulation_type.
 * We normalize to our internal `TenderlySimulateResult` shape used by the UI.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const TENDERLY_DEBUG = import.meta.env.DEV;

function redactTenderlyPath(path: string) {
  // Avoid logging unique IDs in paths (noise + potentially sensitive).
  return path.replace(/\/simulations\/[^/]+/g, "/simulations/:id");
}

function summarizeUnknown(value: unknown) {
  if (value === null) return { type: "null" as const };
  if (value === undefined) return { type: "undefined" as const };
  if (Array.isArray(value))
    return { type: "array" as const, length: value.length };
  if (!isRecord(value)) return { type: typeof value };

  const keys = Object.keys(value);
  const keyPreview = keys.length > 50 ? keys.slice(0, 50).concat("…") : keys;

  const pickArrayLen = (...k: string[]) => {
    for (const key of k) {
      const v = value[key];
      if (Array.isArray(v)) return v.length;
    }
    return undefined;
  };

  const pickArrayLenIn = (obj: unknown, ...k: string[]) => {
    if (!isRecord(obj)) return undefined;
    for (const key of k) {
      const v = obj[key];
      if (Array.isArray(v)) return v.length;
    }
    return undefined;
  };

  const pickNestedKeys = (...k: string[]) => {
    for (const key of k) {
      const v = value[key];
      if (isRecord(v)) {
        const kk = Object.keys(v);
        return kk.length > 50 ? kk.slice(0, 50).concat("…") : kk;
      }
    }
    return undefined;
  };

  const tx = isRecord(value.transaction) ? value.transaction : undefined;
  const sim = isRecord(value.simulation) ? value.simulation : undefined;
  const txInfo =
    tx && isRecord(tx.transaction_info) ? tx.transaction_info : undefined;
  const simShared = sim && isRecord(sim.shared) ? sim.shared : undefined;

  const previewNestedKeys = (v: unknown) => {
    if (!isRecord(v)) return undefined;
    const kk = Object.keys(v);
    return kk.length > 50 ? kk.slice(0, 50).concat("…") : kk;
  };

  return {
    type: "object" as const,
    keys: keyPreview,
    hasResult: "result" in value,
    resultKeys: pickNestedKeys("result"),
    simulationKeys: pickNestedKeys("simulation"),
    transactionKeys: pickNestedKeys("transaction"),
    transactionInfoKeys: previewNestedKeys(txInfo),
    simulationSharedKeys: previewNestedKeys(simShared),
    lengths: {
      trace: pickArrayLen("trace", "call_trace"),
      logs: pickArrayLen("logs"),
      transaction_call_trace: pickArrayLenIn(tx, "call_trace", "trace"),
      transaction_info_call_trace: pickArrayLenIn(txInfo, "call_trace", "trace"),
      transaction_logs: pickArrayLenIn(tx, "logs"),
      transaction_info_logs: pickArrayLenIn(txInfo, "logs"),
      state_changes: pickArrayLen("state_changes", "stateChanges"),
      asset_changes: pickArrayLen("asset_changes", "assetChanges"),
      exposure_changes: pickArrayLen("exposure_changes", "exposureChanges"),
      balance_changes: pickArrayLen("balance_changes", "balanceChanges"),
      generated_access_list: pickArrayLen("generated_access_list"),
    },
  };
}

function pick<T = unknown>(
  obj: Record<string, unknown>,
  ...keys: string[]
): T | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined) return v as T;
  }
  return undefined;
}

function normalizeDecodedParam(value: unknown): TenderlyDecodedParam | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const indexed = pick(value, "indexed", "is_indexed");
  if (indexed !== undefined) out.indexed = indexed;

  return out as TenderlyDecodedParam;
}

function normalizeDecodedParams(
  value: unknown
): TenderlyDecodedParam[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeDecodedParam)
    .filter((p): p is TenderlyDecodedParam => Boolean(p));
}

function normalizeTraceEntry(value: unknown): TenderlyTraceEntry | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const gasUsed = pick(value, "gasUsed", "gas_used");
  if (gasUsed !== undefined) out.gasUsed = gasUsed;

  const traceAddress = pick(value, "traceAddress", "trace_address");
  if (traceAddress !== undefined) out.traceAddress = traceAddress;

  const decodedInput = normalizeDecodedParams(
    pick(value, "decodedInput", "decoded_input")
  );
  if (decodedInput !== undefined) out.decodedInput = decodedInput;

  const decodedOutput = normalizeDecodedParams(
    pick(value, "decodedOutput", "decoded_output")
  );
  if (decodedOutput !== undefined) out.decodedOutput = decodedOutput;

  return out as TenderlyTraceEntry;
}

function normalizeTrace(value: unknown): TenderlyTraceEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeTraceEntry)
    .filter((e): e is TenderlyTraceEntry => Boolean(e));
}

function normalizeLog(value: unknown): TenderlyLog | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const inputs = normalizeDecodedParams(
    pick(value, "inputs", "decoded_inputs")
  );
  if (inputs !== undefined) out.inputs = inputs;

  const raw = pick(value, "raw", "raw_log");
  if (raw !== undefined) out.raw = raw;

  return out as TenderlyLog;
}

function normalizeLogs(value: unknown): TenderlyLog[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(normalizeLog).filter((l): l is TenderlyLog => Boolean(l));
}

function normalizeValueChange(value: unknown) {
  if (!isRecord(value)) return undefined;
  const previousValue = pick(value, "previousValue", "previous_value");
  const newValue = pick(value, "newValue", "new_value");
  if (previousValue === undefined && newValue === undefined) return undefined;
  return { previousValue, newValue };
}

function normalizeStateChange(value: unknown): TenderlyStateChange | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const nonce = normalizeValueChange(pick(value, "nonce"));
  if (nonce) out.nonce = nonce;

  const balance = normalizeValueChange(pick(value, "balance"));
  if (balance) out.balance = balance;

  const storageRaw = pick(value, "storage");
  if (Array.isArray(storageRaw)) {
    out.storage = storageRaw.map((s) => {
      if (!isRecord(s)) return s;
      const prev = pick(s, "previousValue", "previous_value");
      const next = pick(s, "newValue", "new_value");
      return {
        ...s,
        ...(prev !== undefined ? { previousValue: prev } : null),
        ...(next !== undefined ? { newValue: next } : null),
      };
    });
  }

  return out as TenderlyStateChange;
}

function normalizeStateChanges(
  value: unknown
): TenderlyStateChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeStateChange)
    .filter((c): c is TenderlyStateChange => Boolean(c));
}

function normalizeAssetInfo(value: unknown) {
  if (!isRecord(value)) return undefined;
  const out: Record<string, unknown> = { ...value };
  const contractAddress = pick(value, "contractAddress", "contract_address");
  if (contractAddress !== undefined) out.contractAddress = contractAddress;
  const dollarValue = pick(value, "dollarValue", "dollar_value");
  if (dollarValue !== undefined) out.dollarValue = dollarValue;
  return out;
}

function normalizeExposureChange(
  value: unknown
): TenderlyExposureChange | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const rawAmount = pick(value, "rawAmount", "raw_amount");
  if (rawAmount !== undefined) out.rawAmount = rawAmount;

  const dollarValue = pick(value, "dollarValue", "dollar_value");
  if (dollarValue !== undefined) out.dollarValue = dollarValue;

  const assetInfo = normalizeAssetInfo(pick(value, "assetInfo", "asset_info"));
  if (assetInfo !== undefined) out.assetInfo = assetInfo;

  return out as TenderlyExposureChange;
}

function normalizeExposureChanges(
  value: unknown
): TenderlyExposureChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeExposureChange)
    .filter((c): c is TenderlyExposureChange => Boolean(c));
}

function normalizeAssetChange(value: unknown): TenderlyAssetChange | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const rawAmount = pick(value, "rawAmount", "raw_amount");
  if (rawAmount !== undefined) out.rawAmount = rawAmount;

  const dollarValue = pick(value, "dollarValue", "dollar_value");
  if (dollarValue !== undefined) out.dollarValue = dollarValue;

  const assetInfo = normalizeAssetInfo(pick(value, "assetInfo", "asset_info"));
  if (assetInfo !== undefined) out.assetInfo = assetInfo;

  return out as TenderlyAssetChange;
}

function normalizeAssetChanges(
  value: unknown
): TenderlyAssetChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeAssetChange)
    .filter((c): c is TenderlyAssetChange => Boolean(c));
}

function normalizeBalanceChange(value: unknown): TenderlyBalanceChange | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = { ...value };

  const dollarValue = pick(value, "dollarValue", "dollar_value");
  if (dollarValue !== undefined) out.dollarValue = dollarValue;

  return out as TenderlyBalanceChange;
}

function normalizeBalanceChanges(
  value: unknown
): TenderlyBalanceChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeBalanceChange)
    .filter((c): c is TenderlyBalanceChange => Boolean(c));
}

export function normalizeTenderlySimulateResult(
  payload: unknown
): TenderlySimulateResult | null {
  if (!isRecord(payload)) return null;

  if (TENDERLY_DEBUG) {
    console.debug("[tenderly] normalize input", summarizeUnknown(payload));
  }

  // Some Tenderly endpoints return JSON-RPC-like envelopes:
  // { jsonrpc, id, result: { ... }, ...extras }
  // Preserve extra top-level fields (e.g. additional maps/metadata) by merging them into result.
  let base: Record<string, unknown> = payload;
  if ("result" in payload) {
    const r = pick(payload, "result");
    if (isRecord(r)) {
      const extras: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k === "result" || k === "jsonrpc" || k === "id") continue;
        extras[k] = v;
      }
      base = { ...r, ...extras };
    }
  }

  const out: Record<string, unknown> = { ...base };

  const tx = isRecord(out.transaction)
    ? (out.transaction as Record<string, unknown>)
    : undefined;
  const sim = isRecord(out.simulation)
    ? (out.simulation as Record<string, unknown>)
    : undefined;
  const txInfo =
    tx && isRecord(tx.transaction_info)
      ? (tx.transaction_info as Record<string, unknown>)
      : undefined;
  const simShared =
    sim && isRecord(sim.shared) ? (sim.shared as Record<string, unknown>) : undefined;

  // Root fields sometimes come back in snake_case or are nested; the UI expects these at top-level.
  const gasUsed =
    pick(base, "gasUsed", "gas_used") ??
    (sim ? pick(sim, "gasUsed", "gas_used") : undefined) ??
    (tx ? pick(tx, "gasUsed", "gas_used") : undefined) ??
    (txInfo ? pick(txInfo, "gasUsed", "gas_used") : undefined);
  if (gasUsed !== undefined) out.gasUsed = gasUsed;

  const status =
    pick(base, "status") ??
    (sim ? pick(sim, "status") : undefined) ??
    (tx ? pick(tx, "status") : undefined);
  if (status !== undefined) out.status = status;

  const errorMessage =
    pick(base, "errorMessage", "error_message") ??
    (sim ? pick(sim, "errorMessage", "error_message") : undefined) ??
    (tx ? pick(tx, "errorMessage", "error_message") : undefined) ??
    (txInfo ? pick(txInfo, "errorMessage", "error_message") : undefined);
  if (errorMessage !== undefined) out.errorMessage = errorMessage;

  const traceSrc =
    pick(base, "trace", "call_trace") ??
    (tx ? pick(tx, "trace", "call_trace") : undefined) ??
    (txInfo ? pick(txInfo, "trace", "call_trace") : undefined) ??
    (simShared ? pick(simShared, "trace", "call_trace") : undefined);
  const trace = normalizeTrace(traceSrc);
  if (trace !== undefined) out.trace = trace;

  const logsSrc =
    pick(base, "logs") ??
    (tx ? pick(tx, "logs") : undefined) ??
    (txInfo ? pick(txInfo, "logs") : undefined) ??
    (simShared ? pick(simShared, "logs") : undefined);
  const logs = normalizeLogs(logsSrc);
  if (logs !== undefined) out.logs = logs;

  const stateChangesSrc =
    pick(base, "stateChanges", "state_changes") ??
    (simShared ? pick(simShared, "stateChanges", "state_changes") : undefined) ??
    (txInfo ? pick(txInfo, "stateChanges", "state_changes") : undefined);
  const stateChanges = normalizeStateChanges(stateChangesSrc);
  if (stateChanges !== undefined) out.stateChanges = stateChanges;

  const assetChangesSrc =
    pick(base, "assetChanges", "asset_changes") ??
    (simShared ? pick(simShared, "assetChanges", "asset_changes") : undefined) ??
    (txInfo ? pick(txInfo, "assetChanges", "asset_changes") : undefined);
  const assetChanges = normalizeAssetChanges(assetChangesSrc);
  if (assetChanges !== undefined) out.assetChanges = assetChanges;

  const exposureChangesSrc =
    pick(base, "exposureChanges", "exposure_changes") ??
    (simShared
      ? pick(simShared, "exposureChanges", "exposure_changes")
      : undefined) ??
    (txInfo ? pick(txInfo, "exposureChanges", "exposure_changes") : undefined);
  const exposureChanges = normalizeExposureChanges(exposureChangesSrc);
  if (exposureChanges !== undefined) out.exposureChanges = exposureChanges;

  const balanceChangesSrc =
    pick(base, "balanceChanges", "balance_changes") ??
    (simShared
      ? pick(simShared, "balanceChanges", "balance_changes")
      : undefined) ??
    (txInfo ? pick(txInfo, "balanceChanges", "balance_changes") : undefined);
  const balanceChanges = normalizeBalanceChanges(balanceChangesSrc);
  if (balanceChanges !== undefined) out.balanceChanges = balanceChanges;

  if (TENDERLY_DEBUG) {
    console.debug("[tenderly] normalize output", summarizeUnknown(out));
    const trace0 =
      Array.isArray(out.trace) && out.trace.length ? (out.trace[0] as unknown) : undefined;
    if (trace0 && isRecord(trace0)) {
      const keys = Object.keys(trace0);
      console.debug("[tenderly] trace[0] keys", keys.length > 50 ? keys.slice(0, 50).concat("…") : keys);
    }
  }

  return out as TenderlySimulateResult;
}

type TenderlyApiErrorBody =
  | {
      error?: { message?: string; [key: string]: unknown };
      message?: string;
      [key: string]: unknown;
    }
  | undefined;

async function tenderlyApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`/tenderly-api${path}`, init);

  let body: unknown = undefined;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }

  if (TENDERLY_DEBUG) {
    console.debug("[tenderly-api] response", {
      path: redactTenderlyPath(path),
      status: res.status,
      ok: res.ok,
      body: summarizeUnknown(body),
    });
  }

  if (!res.ok) {
    const b = body as TenderlyApiErrorBody;
    const msg =
      b?.error?.message ||
      b?.message ||
      `Tenderly API request failed (${res.status})`;
    throw new Error(msg);
  }

  return body as T;
}

export async function tenderlySimulateAndSave(
  req: TenderlySimulateApiRequest
): Promise<TenderlySimulateResult> {
  if (TENDERLY_DEBUG) {
    const input = typeof req.input === "string" ? req.input.trim() : "";
    const inputBytes =
      input.startsWith("0x") && input.length >= 2
        ? Math.max(0, (input.length - 2) / 2)
        : input.length;
    console.debug("[tenderly-api] simulate request", {
      network_id: req.network_id,
      simulation_type: req.simulation_type,
      save: req.save,
      save_if_fails: req.save_if_fails,
      input_bytes: inputBytes,
      gas: req.gas,
      // Intentionally do not log full calldata / from/to.
    });
  }

  const payload = await tenderlyApiFetch<unknown>("/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });

  const result = normalizeTenderlySimulateResult(payload);
  if (!result) throw new Error("Unexpected Tenderly simulate response");
  return result;
}

export type TenderlySavedSimulationListResponse = {
  simulations?: unknown[];
  data?: unknown[];
  results?: unknown[];
  [key: string]: unknown;
};

export async function tenderlyListSavedSimulations(): Promise<unknown[]> {
  const payload = await tenderlyApiFetch<TenderlySavedSimulationListResponse>(
    "/simulations",
    { method: "GET" }
  );

  const arr =
    (Array.isArray(payload.simulations) && payload.simulations) ||
    (Array.isArray(payload.data) && payload.data) ||
    (Array.isArray(payload.results) && payload.results) ||
    [];
  return arr;
}

export async function tenderlyGetSavedSimulationById(
  simulationId: string
): Promise<TenderlySimulateResult> {
  const payload = await tenderlyApiFetch<unknown>(
    `/simulations/${simulationId}`,
    {
      method: "GET",
    }
  );

  const result = normalizeTenderlySimulateResult(payload);
  if (!result) throw new Error("Unexpected Tenderly simulation response");
  return result;
}
