import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { isAddress } from "viem";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarList, type BarListItem } from "@/components/ui/viz/BarList";
import { DashboardMetric } from "@/components/ui/viz/DashboardMetric";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatIntString,
  hexToBigIntSafe,
  shortenHex,
  shortenString,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TenderlyTraceEntry } from "@/lib/tenderly";
import { ContractAddress } from "../../shared/ContractAddress";
import { CopyButton } from "../../shared/CopyButton";
import { CallTraceTree, type CallTraceTreeValueMode } from "./CallTraceTree";

export interface GasDashboardProps {
  simulationTrace: TenderlyTraceEntry[];
  simulationGasUsedBi: bigint | undefined;
  simulationStatus?: boolean;
  simulationErrorMessage?: string;
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
  generatedAccessList?: { address: string; storage_keys: string[] }[];
}

type GasNode = {
  key: string;
  parentKey: string | null;
  entry: TenderlyTraceEntry;
  gasUsed: bigint;
  exclusiveGasUsed: bigint;
  methodLabel: string;
  toLabel: string;
  toTitle?: string;
  toAddress?: string;
  traceAddress: number[];
};

function buildGasNodes(
  trace: TenderlyTraceEntry[],
  resolveContractName?: (address?: string) => string | undefined
) {
  const nodesByKey = new Map<string, GasNode>();
  const childrenByKey = new Map<string, string[]>();

  for (const entry of trace) {
    const gasUsed = hexToBigIntSafe(entry.gasUsed) ?? 0n;
    const traceAddress = Array.isArray(entry.traceAddress)
      ? entry.traceAddress
      : [];
    const key = JSON.stringify(traceAddress);
    const parentKey = traceAddress.length
      ? JSON.stringify(traceAddress.slice(0, -1))
      : null;

    const methodLabel =
      typeof entry.method === "string" && entry.method.trim()
        ? entry.method
        : typeof entry.type === "string" && entry.type.trim()
        ? entry.type
        : "CALL";

    const toAddress = typeof entry.to === "string" ? entry.to : undefined;
    const contractName = toAddress
      ? resolveContractName?.(toAddress)
      : undefined;
    const toTitle =
      contractName && toAddress ? `${contractName} · ${toAddress}` : toAddress;
    const toLabel = contractName
      ? shortenString(contractName, 14, 8)
      : typeof entry.to === "string" && isAddress(entry.to)
      ? shortenHex(entry.to)
      : typeof entry.to === "string"
      ? shortenString(entry.to, 10, 8)
      : "—";

    nodesByKey.set(key, {
      key,
      parentKey,
      entry,
      gasUsed,
      exclusiveGasUsed: 0n,
      methodLabel,
      toLabel,
      toTitle,
      toAddress,
      traceAddress,
    });

    if (parentKey) {
      const existing = childrenByKey.get(parentKey) ?? [];
      existing.push(key);
      childrenByKey.set(parentKey, existing);
    }
  }

  for (const [key, node] of nodesByKey.entries()) {
    const childKeys = childrenByKey.get(key) ?? [];
    let childrenGas = 0n;
    for (const childKey of childKeys) {
      const child = nodesByKey.get(childKey);
      if (!child) continue;
      childrenGas += child.gasUsed;
    }
    node.exclusiveGasUsed =
      node.gasUsed > childrenGas ? node.gasUsed - childrenGas : 0n;
  }

  return nodesByKey;
}

function median(values: bigint[]) {
  if (!values.length) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  // integer mid, keep it bigint-safe: average of middle two
  return (sorted[mid - 1]! + sorted[mid]!) / 2n;
}

const chartConfig = {
  gas: {
    label: "Gas",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function GasView({
  simulationTrace,
  simulationGasUsedBi,
  simulationStatus,
  simulationErrorMessage,
  chainId,
  resolveContractName,
  generatedAccessList,
}: GasDashboardProps) {
  const valueMode: CallTraceTreeValueMode = "inclusive";

  const nodesByKey = React.useMemo(
    () =>
      buildGasNodes(
        Array.isArray(simulationTrace) ? simulationTrace : [],
        resolveContractName
      ),
    [simulationTrace, resolveContractName]
  );

  const totals = React.useMemo(() => {
    const nodes = Array.from(nodesByKey.values());
    const executionGas = nodes.reduce((sum, n) => sum + n.exclusiveGasUsed, 0n);

    const totalGas =
      typeof simulationGasUsedBi === "bigint" && simulationGasUsedBi > 0n
        ? simulationGasUsedBi
        : executionGas;

    const overheadGas = totalGas > executionGas ? totalGas - executionGas : 0n;
    const overheadPct =
      totalGas > 0n ? Number((overheadGas * 10000n) / totalGas) / 100 : 0;

    const exclusiveNonZero = nodes
      .map((n) => n.exclusiveGasUsed)
      .filter((v) => v > 0n);
    const p50 = median(exclusiveNonZero);
    const maxExclusive = exclusiveNonZero.reduce((m, v) => (v > m ? v : m), 0n);
    const maxVsMedian =
      p50 > 0n ? Number((maxExclusive * 100n) / p50) / 100 : 0;

    const topNodes = [...nodes]
      .filter((n) => n.exclusiveGasUsed > 0n)
      .sort((a, b) => (a.exclusiveGasUsed < b.exclusiveGasUsed ? 1 : -1))
      .slice(0, 6);

    const top5Share =
      executionGas > 0n
        ? Number(
            (topNodes.slice(0, 5).reduce((s, n) => s + n.exclusiveGasUsed, 0n) *
              10000n) /
              executionGas
          ) / 100
        : 0;

    const accountsTouched = new Set<string>();
    for (const n of nodes) {
      if (typeof n.entry.from === "string" && isAddress(n.entry.from))
        accountsTouched.add(n.entry.from.toLowerCase());
      if (typeof n.entry.to === "string" && isAddress(n.entry.to))
        accountsTouched.add(n.entry.to.toLowerCase());
    }

    return {
      totalGas,
      executionGas,
      overheadGas,
      overheadPct,
      p50,
      maxExclusive,
      maxVsMedian,
      topNodes,
      top5Share,
      accountsTouchedCount: accountsTouched.size,
    };
  }, [nodesByKey, simulationGasUsedBi]);

  const gasSeries = React.useMemo(() => {
    // ordered by traceAddress (roughly execution order)
    const nodes = Array.from(nodesByKey.values()).sort((a, b) => {
      const aa = a.traceAddress;
      const bb = b.traceAddress;
      const len = Math.max(aa.length, bb.length);
      for (let i = 0; i < len; i++) {
        const ai = aa[i];
        const bi = bb[i];
        if (ai === undefined) return -1;
        if (bi === undefined) return 1;
        if (ai !== bi) return ai < bi ? -1 : 1;
      }
      return 0;
    });

    return nodes
      .filter((n) => n.exclusiveGasUsed > 0n)
      .slice(0, 80)
      .map((n, i) => ({
        i,
        gas: Number(n.exclusiveGasUsed),
        label: `${n.methodLabel} → ${n.toLabel}`,
        to: n.toTitle,
      }));
  }, [nodesByKey]);

  const topAccountsBarList = React.useMemo<BarListItem[]>(() => {
    const byTo = new Map<string, { to: string; gas: bigint }>();
    for (const n of nodesByKey.values()) {
      if (!n.toAddress || !isAddress(n.toAddress)) continue;
      const key = n.toAddress.toLowerCase();
      const existing = byTo.get(key) ?? { to: n.toAddress, gas: 0n };
      existing.gas += n.exclusiveGasUsed;
      byTo.set(key, existing);
    }

    const rows = [...byTo.values()]
      .filter((r) => r.gas > 0n)
      .sort((a, b) => (a.gas < b.gas ? 1 : -1))
      .slice(0, 8);

    return rows.map((r) => ({
      label: (
        <ContractAddress
          address={r.to}
          label={resolveContractName?.(r.to)}
          showCopy={true}
          showExplorer={true}
          chainId={chainId}
        />
      ),
      value: Number(r.gas),
      rightLabel: formatIntString(r.gas.toString()),
    }));
  }, [nodesByKey, chainId, resolveContractName]);

  const accessListStats = React.useMemo(() => {
    const list = Array.isArray(generatedAccessList) ? generatedAccessList : [];
    const rows = list
      .map((a) => ({
        address: a.address,
        keys: Array.isArray(a.storage_keys) ? a.storage_keys.length : 0,
      }))
      .filter((r) => typeof r.address === "string" && r.keys > 0)
      .sort((a, b) => b.keys - a.keys);
    const totalKeys = rows.reduce((sum, r) => sum + r.keys, 0);
    return { list, rows, totalKeys };
  }, [generatedAccessList]);

  if (!simulationTrace.length && simulationStatus !== false) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 p-10 text-center text-sm text-muted-foreground">
        No trace data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simulationStatus === false ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Transaction Reverted</p>
            {simulationErrorMessage ? (
              <p className="font-mono text-xs opacity-90 break-all">
                {simulationErrorMessage}
              </p>
            ) : (
              <p className="opacity-90">
                The transaction failed during simulation. Check the trace below
                for the revert reason.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetric
          title="Total Gas"
          value={
            totals.totalGas > 0n
              ? formatIntString(totals.totalGas.toString())
              : "—"
          }
          subValue={
            <>
              Execution{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatIntString(totals.executionGas.toString())}
              </span>{" "}
              and Overhead{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatIntString(totals.overheadGas.toString())}
              </span>
            </>
          }
        />

        <DashboardMetric
          title="Concentration"
          value={totals.top5Share > 0 ? `${totals.top5Share.toFixed(2)}%` : "—"}
          subValue="Top 5 calls share of execution gas"
        />

        <DashboardMetric
          title="Peak vs Median"
          value={
            totals.maxVsMedian > 0 ? `${totals.maxVsMedian.toFixed(2)}×` : "—"
          }
          subValue="Largest exclusive call vs median"
        />

        <DashboardMetric
          title="Accounts Touched"
          value={totals.accountsTouchedCount}
          subValue="Unique from/to addresses across the call graph"
        />
      </div>

      {/* Main surface */}
      <div className="space-y-3">
        {/* Call tree (full width) */}
        <Card className={cn("overflow-hidden")}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-sm">Call tree</CardTitle>
              <CardDescription className="text-xs">
                Expand branches to see gas attribution across all calls
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[600px] overflow-auto pr-1">
              <CallTraceTree
                trace={simulationTrace}
                totalGas={totals.totalGas}
                valueMode={valueMode}
                defaultExpandedDepth={2}
                chainId={chainId}
                resolveContractName={resolveContractName}
                className="animate-in fade-in-0 duration-300"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Gas series */}
          <Card className="overflow-hidden lg:col-span-2">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Gas distribution</CardTitle>
              <CardDescription className="text-xs">
                Exclusive gas per call (execution order)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[240px] w-full"
              >
                <AreaChart
                  data={gasSeries}
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="fillGas" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-gas)"
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-gas)"
                        stopOpacity={0.08}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="i" hide />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const p = payload?.[0]?.payload as
                            | { label?: string; to?: string }
                            | undefined;
                          return p?.label ?? "Call";
                        }}
                        formatter={(value) => {
                          const n =
                            typeof value === "number" ? value : Number(value);
                          if (!Number.isFinite(n)) return null;
                          return (
                            <span className="font-mono tabular-nums">
                              {formatIntString(Math.floor(n).toString())}
                            </span>
                          );
                        }}
                      />
                    }
                  />
                  <Area
                    dataKey="gas"
                    type="natural"
                    fill="url(#fillGas)"
                    stroke="var(--color-gas)"
                    isAnimationActive
                    animationDuration={500}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {/* Top accounts */}
            <Card className="overflow-hidden">
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm">Top accounts by gas</CardTitle>
                <CardDescription className="text-xs">
                  Exclusive gas aggregated by callee address
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {topAccountsBarList.length ? (
                  <BarList
                    items={topAccountsBarList}
                    maxItems={8}
                    showPercentage={false}
                    barClassName="bg-primary"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>

            {/* Access list */}
            <Card className="overflow-hidden">
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm">Generated access list</CardTitle>
                <CardDescription className="text-xs">
                  EIP-2930 access list (addresses + storage keys)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {accessListStats.list.length ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {accessListStats.list.length} addresses •{" "}
                        {accessListStats.totalKeys} storage keys
                      </span>
                      <CopyButton
                        text={JSON.stringify(accessListStats.list, null, 2)}
                        size="sm"
                      />
                    </div>
                    <BarList
                      items={accessListStats.rows.slice(0, 8).map((r) => ({
                        label: (
                          <ContractAddress
                            address={r.address}
                            label={resolveContractName?.(r.address)}
                            showCopy={true}
                            showExplorer={true}
                            chainId={chainId}
                          />
                        ),
                        value: r.keys,
                        rightLabel: `${r.keys}`,
                      }))}
                      maxItems={8}
                      showPercentage={false}
                      barClassName="bg-primary/40"
                    />
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
