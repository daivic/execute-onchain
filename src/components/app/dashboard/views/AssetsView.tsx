import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardMetric } from "@/components/ui/viz/DashboardMetric";
import { GainLossBar } from "@/components/ui/viz/GainLossBar";
import { BarList, type BarListItem } from "@/components/ui/viz/BarList";
import { shortenHex } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContractAddress } from "@/components/app/shared/ContractAddress";
import { useMemo, useState } from "react";
import type {
  TenderlyAssetChange,
  TenderlyBalanceChange,
  TenderlyExposureChange,
} from "@/lib/tenderly";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssetsTabProps {
  simulationAssetChanges: TenderlyAssetChange[];
  simulationExposureChanges: TenderlyExposureChange[];
  simulationBalanceChanges: TenderlyBalanceChange[];
  actorAddress?: string;
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
  hideKpis?: boolean;
}

type FlowRange = "30" | "100" | "all";

type DetailTab = "transfers" | "exposure" | "balances" | "participants";

type TokenViz = "bar" | "radar";

const DETAIL_ROW_LIMIT = 20;

const usdFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

const parseUsd = (v?: string) => {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const formatUsdNumber = (v: number) => usdFormatter.format(v);

const formatUsdCompact = (v: number) => usdCompactFormatter.format(v);

const safeText = (v: unknown) =>
  typeof v === "string" && v.trim().length ? v.trim() : undefined;

function downsample(values: number[], maxPoints: number) {
  if (values.length <= maxPoints) return values;
  const step = values.length / maxPoints;
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(values[Math.floor(i * step)] ?? 0);
  }
  return out;
}

function AddressText({
  address,
  actorLower,
  chainId,
  resolveContractName,
}: {
  address?: string;
  actorLower?: string;
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
}) {
  if (!address) return <span className="text-muted-foreground">—</span>;
  const isActor = actorLower && address.toLowerCase() === actorLower;
  return (
    <ContractAddress
      address={address}
      label={resolveContractName?.(address)}
      className={cn("text-xs", isActor && "text-primary font-semibold")}
      showCopy={true}
      showExplorer={true}
      chainId={chainId}
    />
  );
}

function TokenCell({
  symbol,
  name,
  logo,
}: {
  symbol?: string;
  name?: string;
  logo?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-6 w-6">
        <AvatarImage src={logo} alt={symbol} />
        <AvatarFallback className="text-[9px] font-bold">
          {symbol?.slice(0, 2).toUpperCase() || "??"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate text-xs">
          {symbol || "Unknown"}
        </div>
        {name && (
          <div className="text-[10px] text-muted-foreground truncate">
            {name}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssetsView({
  simulationAssetChanges,
  simulationExposureChanges,
  simulationBalanceChanges,
  actorAddress,
  chainId,
  resolveContractName,
  hideKpis = false,
}: AssetsTabProps) {
  const [flowRange, setFlowRange] = useState<FlowRange>("30");
  const [tokenViz, setTokenViz] = useState<TokenViz>("bar");
  const [detailTab, setDetailTab] = useState<DetailTab>("transfers");
  const [showAllByTab, setShowAllByTab] = useState<Record<DetailTab, boolean>>({
    transfers: false,
    exposure: false,
    balances: false,
    participants: false,
  });

  const toggleShowAll = (tab: DetailTab) => {
    setShowAllByTab((s) => ({ ...s, [tab]: !s[tab] }));
  };

  const actorLower = safeText(actorAddress)?.toLowerCase();

  const assetsFiltered = simulationAssetChanges;
  const exposureFiltered = simulationExposureChanges;
  const balanceFiltered = simulationBalanceChanges;

  const stats = useMemo(() => {
    let receivedUsd = 0;
    let sentUsd = 0;
    let totalVolumeUsd = 0;

    type TokenRow = {
      key: string;
      symbol: string;
      name?: string;
      logo?: string;
      usd: number;
      count: number;
    };

    type ParticipantRow = {
      key: string;
      address: string;
      inUsd: number;
      outUsd: number;
      netUsd: number;
      volumeUsd: number;
    };

    const byToken = new Map<string, TokenRow>();
    const byParticipant = new Map<
      string,
      { address: string; inUsd: number; outUsd: number }
    >();

    const flowPoints: number[] = [];
    let cumulativeNet = 0;

    for (const change of assetsFiltered) {
      const usdRaw = parseUsd(change.dollarValue);
      if (usdRaw === undefined) continue;
      const usd = Math.abs(usdRaw);
      if (usd <= 0) continue;

      totalVolumeUsd += usd;

      const from = safeText(change.from);
      const to = safeText(change.to);

      const fromLower = from?.toLowerCase();
      const toLower = to?.toLowerCase();

      if (actorLower) {
        if (fromLower === actorLower) sentUsd += usd;
        if (toLower === actorLower) receivedUsd += usd;
      }

      if (fromLower) {
        const existing = byParticipant.get(fromLower) ?? {
          address: from!,
          inUsd: 0,
          outUsd: 0,
        };
        existing.outUsd += usd;
        byParticipant.set(fromLower, existing);
      }

      if (toLower) {
        const existing = byParticipant.get(toLower) ?? {
          address: to!,
          inUsd: 0,
          outUsd: 0,
        };
        existing.inUsd += usd;
        byParticipant.set(toLower, existing);
      }

      const symbol = safeText(change.assetInfo?.symbol);
      const name = safeText(change.assetInfo?.name);
      const logo = safeText(change.assetInfo?.logo);
      const key = symbol || name || "Unknown";

      const token = byToken.get(key) ?? {
        key,
        symbol: symbol || key,
        name,
        logo,
        usd: 0,
        count: 0,
      };
      token.usd += usd;
      token.count += 1;
      byToken.set(key, token);

      // Flow series: actor => cumulative net. no actor => per-change volume.
      if (actorLower) {
        const delta =
          (toLower === actorLower ? usd : 0) -
          (fromLower === actorLower ? usd : 0);
        cumulativeNet += delta;
        flowPoints.push(cumulativeNet);
      } else {
        flowPoints.push(usd);
      }
    }

    const tokenRows = [...byToken.values()].sort((a, b) => b.usd - a.usd);

    const participantRows: ParticipantRow[] = [...byParticipant.entries()]
      .map(([key, v]) => {
        const netUsd = v.inUsd - v.outUsd;
        return {
          key,
          address: v.address,
          inUsd: v.inUsd,
          outUsd: v.outUsd,
          netUsd,
          volumeUsd: v.inUsd + v.outUsd,
        };
      })
      .sort((a, b) => b.volumeUsd - a.volumeUsd);

    const participantsExActor = actorLower
      ? participantRows.filter((p) => p.key !== actorLower)
      : participantRows;

    const netUsd = actorLower ? receivedUsd - sentUsd : 0;

    return {
      receivedUsd,
      sentUsd,
      netUsd,
      totalVolumeUsd,
      flowPoints,
      tokenRows,
      participantRows: participantsExActor,
    };
  }, [assetsFiltered, actorLower]);

  const totalAssetUsd = useMemo(() => {
    let sum = 0;
    for (const c of simulationAssetChanges) sum += parseUsd(c.dollarValue) ?? 0;
    for (const c of simulationExposureChanges)
      sum += parseUsd(c.dollarValue) ?? 0;
    return sum;
  }, [simulationAssetChanges, simulationExposureChanges]);

  const flowValuesForRange = useMemo(() => {
    const points = stats.flowPoints;
    if (!points.length) return [];

    const lastN =
      flowRange === "all"
        ? points
        : points.slice(-Number.parseInt(flowRange, 10));

    // Keep the motion, stay readable.
    return downsample(lastN, 60);
  }, [stats.flowPoints, flowRange]);

  const flowChartData = useMemo(
    () => flowValuesForRange.map((value, idx) => ({ idx, value })),
    [flowValuesForRange]
  );

  const tokenBarData = useMemo(
    () =>
      stats.tokenRows.slice(0, 8).map((t) => ({
        name: t.symbol.length > 6 ? t.symbol.slice(0, 6) + "…" : t.symbol,
        value: t.usd,
      })),
    [stats.tokenRows]
  );

  const tokenRadarData = useMemo(() => {
    const top = stats.tokenRows.slice(0, 6);
    const max = Math.max(...top.map((t) => t.usd), 1);
    return top.map((t) => ({
      name: t.symbol.length > 8 ? t.symbol.slice(0, 8) + "…" : t.symbol,
      pct: (t.usd / max) * 100,
      usd: t.usd,
    }));
  }, [stats.tokenRows]);

  const tokenBarListItems = useMemo<BarListItem[]>(() => {
    return stats.tokenRows.slice(0, 6).map((t) => ({
      label: t.symbol,
      value: t.usd,
      rightLabel: `$${formatUsdNumber(t.usd)}`,
      icon: t.logo ? (
        <Avatar className="h-4 w-4 mr-2">
          <AvatarImage src={t.logo} />
          <AvatarFallback>{t.symbol[0]}</AvatarFallback>
        </Avatar>
      ) : undefined,
    }));
  }, [stats.tokenRows]);

  const transfersRanked = useMemo(() => {
    return [...assetsFiltered]
      .map((c) => ({
        c,
        usd: Math.abs(parseUsd(c.dollarValue) ?? 0),
      }))
      .sort((a, b) => b.usd - a.usd);
  }, [assetsFiltered]);

  const exposureRanked = useMemo(() => {
    return exposureFiltered
      .map((c) => ({
        c,
        usd: Math.abs(parseUsd(c.dollarValue) ?? 0),
      }))
      .sort((a, b) => b.usd - a.usd);
  }, [exposureFiltered]);

  const balancesRanked = useMemo(() => {
    return balanceFiltered
      .map((c) => ({
        c,
        usd: Math.abs(parseUsd(c.dollarValue) ?? 0),
        refs: Array.isArray(c.transfers) ? c.transfers.length : 0,
      }))
      .sort((a, b) => b.usd - a.usd);
  }, [balanceFiltered]);

  const netTone = stats.netUsd >= 0 ? "text-success" : "text-destructive";

  const netFlowData = useMemo(() => {
    const sorted = [...stats.participantRows]
      .filter((p) => Math.abs(p.netUsd) > 0.01)
      .sort((a, b) => b.netUsd - a.netUsd);
    if (!sorted.length) return [];

    const gainers = sorted.filter((p) => p.netUsd > 0);
    const losers = sorted.filter((p) => p.netUsd < 0);

    let data = [];
    if (gainers.length + losers.length <= 12) {
      data = sorted;
    } else {
      data = [...gainers.slice(0, 6), ...losers.slice(-6)];
    }

    return data.map((p) => ({
      address: p.address,
      name: shortenHex(p.address),
      net: p.netUsd,
    }));
  }, [stats.participantRows]);

  const kpiBase =
    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {!hideKpis && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actorLower ? (
            <>
              <DashboardMetric
                title="Net"
                value={
                  <span className={cn("tabular-nums", netTone)}>
                    {stats.netUsd >= 0 ? "+" : "-"}$
                    {formatUsdNumber(Math.abs(stats.netUsd))}
                  </span>
                }
                subValue={
                  <span className="tabular-nums">
                    In ${formatUsdCompact(stats.receivedUsd)} • Out $
                    {formatUsdCompact(stats.sentUsd)}
                  </span>
                }
                badgeIcon={
                  stats.netUsd >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )
                }
                badgeText={stats.netUsd >= 0 ? "Profit" : "Loss"}
                badgeVariant={stats.netUsd >= 0 ? "outline" : "destructive"}
              />
              <DashboardMetric
                title="Received"
                value={
                  <span className="tabular-nums">
                    ${formatUsdNumber(stats.receivedUsd)}
                  </span>
                }
                subValue={<span>{assetsFiltered.length} transfers</span>}
              />
              <DashboardMetric
                title="Sent"
                value={
                  <span className="tabular-nums">
                    ${formatUsdNumber(stats.sentUsd)}
                  </span>
                }
                subValue={<span>{stats.tokenRows.length} tokens</span>}
              />
              <DashboardMetric
                title="Participants"
                value={
                  <span className="tabular-nums">
                    {stats.participantRows.length}
                  </span>
                }
                subValue={<span>Unique counterparties</span>}
              />
            </>
          ) : (
            <>
              <DashboardMetric
                title="Transfer volume"
                value={
                  <span className="tabular-nums">
                    ${formatUsdNumber(stats.totalVolumeUsd)}
                  </span>
                }
                subValue={<span>{assetsFiltered.length} transfers</span>}
              />
              <DashboardMetric
                title="Tokens"
                value={
                  <span className="tabular-nums">{stats.tokenRows.length}</span>
                }
                subValue={<span>Impacted assets</span>}
              />
              <DashboardMetric
                title="Participants"
                value={
                  <span className="tabular-nums">
                    {stats.participantRows.length}
                  </span>
                }
                subValue={<span>Unique addresses</span>}
              />
              <DashboardMetric
                title="Total (assets + exposure)"
                value={
                  <span className="tabular-nums">
                    ${formatUsdNumber(totalAssetUsd)}
                  </span>
                }
                subValue={<span>Known USD values</span>}
              />
            </>
          )}
        </div>
      )}

      {/* Charts */}
      {assetsFiltered.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Flow */}
          <Card className={cn("overflow-hidden", kpiBase)}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-sm">
                  {actorLower ? "Account flow" : "Transfer sizes"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {actorLower
                    ? "Cumulative net USD across transfers"
                    : "USD size per transfer"}
                </CardDescription>
              </div>
              <Tabs
                value={flowRange}
                onValueChange={(v) => setFlowRange(v as FlowRange)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="30" className="px-2 text-xs">
                    30
                  </TabsTrigger>
                  <TabsTrigger value="100" className="px-2 text-xs">
                    100
                  </TabsTrigger>
                  <TabsTrigger value="all" className="px-2 text-xs">
                    All
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={flowChartData}
                    margin={{ left: 0, right: 0 }}
                  >
                    <defs>
                      <linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="hsl(var(--border) / 0.5)"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="idx" hide />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--border) / 0.7)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const v = payload[0]?.value;
                        if (typeof v !== "number") return null;
                        return (
                          <div className="rounded-lg border border-border/60 bg-card/80 backdrop-blur-xl px-2.5 py-1.5 text-xs shadow-md ring-1 ring-white/10">
                            <div className="font-mono font-semibold tabular-nums text-foreground">
                              {actorLower ? (
                                <span
                                  className={cn(
                                    v >= 0 ? "text-success" : "text-destructive"
                                  )}
                                >
                                  {v >= 0 ? "+" : "-"}$
                                  {formatUsdNumber(Math.abs(v))}
                                </span>
                              ) : (
                                <span>${formatUsdNumber(Math.abs(v))}</span>
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              {actorLower ? "Cumulative net" : "Transfer size"}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#flowFill)"
                      dot={false}
                      isAnimationActive
                      animationDuration={450}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {actorLower ? (
                <GainLossBar
                  inflow={stats.receivedUsd}
                  outflow={stats.sentUsd}
                  labelIn="In"
                  labelOut="Out"
                  formatValue={formatUsdNumber}
                  className="mt-3"
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Tokens */}
          <Card className={cn("overflow-hidden", kpiBase)}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-sm">Top tokens</CardTitle>
                <CardDescription className="text-xs">
                  Highest USD impact in this view
                </CardDescription>
              </div>
              <Tabs
                value={tokenViz}
                onValueChange={(v) => setTokenViz(v as TokenViz)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="bar" className="px-2 text-xs">
                    Bar
                  </TabsTrigger>
                  <TabsTrigger value="radar" className="px-2 text-xs">
                    Radar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  {tokenViz === "radar" ? (
                    <RadarChart data={tokenRadarData} outerRadius="80%">
                      <defs>
                        <linearGradient
                          id="tokenRadarFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.06}
                          />
                        </linearGradient>
                      </defs>
                      <PolarGrid stroke="hsl(var(--border) / 0.55)" />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          const usd =
                            typeof (p?.payload as { usd?: unknown } | undefined)
                              ?.usd === "number"
                              ? (p.payload as { usd: number }).usd
                              : undefined;
                          return (
                            <div className="rounded-lg border border-border/60 bg-card/80 backdrop-blur-xl px-2.5 py-1.5 text-xs shadow-md ring-1 ring-white/10">
                              <div className="text-muted-foreground">
                                {label}
                              </div>
                              <div className="font-mono font-semibold tabular-nums text-foreground">
                                {usd !== undefined
                                  ? `$${formatUsdNumber(usd)}`
                                  : "—"}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Radar
                        dataKey="pct"
                        stroke="hsl(var(--primary))"
                        fill="url(#tokenRadarFill)"
                        fillOpacity={1}
                        isAnimationActive
                        animationDuration={450}
                      />
                    </RadarChart>
                  ) : (
                    <BarChart
                      data={tokenBarData}
                      margin={{ left: 0, right: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="tokenFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.35}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="hsl(var(--border) / 0.5)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        fontSize={10}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const v = payload[0]?.value;
                          if (typeof v !== "number") return null;
                          return (
                            <div className="rounded-lg border border-border/60 bg-card/80 backdrop-blur-xl px-2.5 py-1.5 text-xs shadow-md ring-1 ring-white/10">
                              <div className="text-muted-foreground">
                                {label}
                              </div>
                              <div className="font-mono font-semibold tabular-nums text-foreground">
                                ${formatUsdNumber(v)}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="url(#tokenFill)"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive
                        animationDuration={450}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {tokenBarListItems.length ? (
                <div className="pt-1">
                  <BarList
                    items={tokenBarListItems}
                    maxItems={6}
                    showPercentage={false}
                    barClassName="bg-primary/60"
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </CardContent>
          </Card>

          {/* New Net Flow Chart */}
          <Card className={cn("overflow-hidden lg:col-span-2", kpiBase)}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Net Flow by Participant</CardTitle>
              <CardDescription className="text-xs">
                Top gainers and losers (USD)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={netFlowData}
                    layout="vertical"
                    margin={{ left: 0, right: 30, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="hsl(var(--border) / 0.5)"
                      strokeDasharray="3 3"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      interval={0}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const v = payload[0]?.value;
                        if (typeof v !== "number") return null;
                        return (
                          <div className="rounded-lg border border-border/60 bg-card/80 backdrop-blur-xl px-2.5 py-1.5 text-xs shadow-md ring-1 ring-white/10">
                            <div className="text-muted-foreground">{label}</div>
                            <div
                              className={cn(
                                "font-mono font-semibold tabular-nums",
                                v >= 0 ? "text-success" : "text-destructive"
                              )}
                            >
                              {v >= 0 ? "+" : "-"}$
                              {formatUsdNumber(Math.abs(v))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="net" radius={[2, 2, 2, 2]}>
                      {netFlowData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.net > 0
                              ? "hsl(var(--success))"
                              : "hsl(var(--destructive))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-10 text-center text-sm text-muted-foreground">
          No transfers to visualize.
        </div>
      )}

      {/* Detail tables */}
      <Tabs
        value={detailTab}
        onValueChange={(v) => setDetailTab(v as DetailTab)}
      >
        <TabsList className="h-9">
          <TabsTrigger value="transfers" className="text-xs">
            Transfers ({assetsFiltered.length})
          </TabsTrigger>
          <TabsTrigger value="exposure" className="text-xs">
            Allowances ({exposureFiltered.length})
          </TabsTrigger>
          <TabsTrigger value="balances" className="text-xs">
            Balances ({balanceFiltered.length})
          </TabsTrigger>
          <TabsTrigger value="participants" className="text-xs">
            Participants ({stats.participantRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfers">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Transfers</CardTitle>
              <CardDescription className="text-xs">
                Largest changes by known USD value
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[340px]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Asset
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Type
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        From
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        To
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        Amount
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        USD
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfersRanked
                      .slice(
                        0,
                        showAllByTab.transfers
                          ? transfersRanked.length
                          : DETAIL_ROW_LIMIT
                      )
                      .map(({ c, usd }, i) => {
                        const symbol = safeText(c.assetInfo?.symbol);
                        const name = safeText(c.assetInfo?.name);
                        const logo = safeText(c.assetInfo?.logo);
                        const type = safeText(c.type) || "Change";
                        return (
                          <TableRow key={i}>
                            <TableCell className="px-3 py-2">
                              <TokenCell
                                symbol={symbol}
                                name={name}
                                logo={logo}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2 text-muted-foreground">
                              {type}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <AddressText
                                address={safeText(c.from)}
                                actorLower={actorLower}
                                resolveContractName={resolveContractName}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <AddressText
                                address={safeText(c.to)}
                                actorLower={actorLower}
                                resolveContractName={resolveContractName}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                              {safeText(c.amount) ?? "—"}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                              {usd ? `$${formatUsdNumber(usd)}` : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {transfersRanked.length > DETAIL_ROW_LIMIT ? (
                <div className="flex items-center justify-end border-t border-border/60 p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => toggleShowAll("transfers")}
                  >
                    {showAllByTab.transfers
                      ? "Show fewer"
                      : `Show all (${transfersRanked.length})`}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exposure">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Allowances</CardTitle>
              <CardDescription className="text-xs">
                Exposure / approvals with known USD values
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[340px]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Asset
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Owner
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Spender
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        Amount
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        USD
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exposureRanked
                      .slice(
                        0,
                        showAllByTab.exposure
                          ? exposureRanked.length
                          : DETAIL_ROW_LIMIT
                      )
                      .map(({ c, usd }, i) => {
                        const symbol = safeText(c.assetInfo?.symbol);
                        const name = safeText(c.assetInfo?.name);
                        const logo = safeText(c.assetInfo?.logo);
                        return (
                          <TableRow key={i}>
                            <TableCell className="px-3 py-2">
                              <TokenCell
                                symbol={symbol}
                                name={name}
                                logo={logo}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <AddressText
                                address={safeText(c.owner)}
                                actorLower={actorLower}
                                resolveContractName={resolveContractName}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <AddressText
                                address={safeText(c.spender)}
                                actorLower={actorLower}
                                resolveContractName={resolveContractName}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                              {safeText(c.amount) ?? "—"}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                              {usd ? `$${formatUsdNumber(usd)}` : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {exposureRanked.length > DETAIL_ROW_LIMIT ? (
                <div className="flex items-center justify-end border-t border-border/60 p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => toggleShowAll("exposure")}
                  >
                    {showAllByTab.exposure
                      ? "Show fewer"
                      : `Show all (${exposureRanked.length})`}
                  </Button>
                </div>
              ) : null}

              {!exposureFiltered.length ? (
                <div className="border-t border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No allowances.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Balance changes</CardTitle>
              <CardDescription className="text-xs">
                Addresses with balance deltas (when available)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[340px]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Address
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        USD
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        Refs
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancesRanked
                      .slice(
                        0,
                        showAllByTab.balances
                          ? balancesRanked.length
                          : DETAIL_ROW_LIMIT
                      )
                      .map(({ c, usd, refs }, i) => {
                        const addr = safeText(c.address);
                        return (
                          <TableRow key={i}>
                            <TableCell className="px-3 py-2">
                              <AddressText
                                address={addr}
                                actorLower={actorLower}
                                resolveContractName={resolveContractName}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                              {usd ? `$${formatUsdNumber(usd)}` : "—"}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                              {refs || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {balancesRanked.length > DETAIL_ROW_LIMIT ? (
                <div className="flex items-center justify-end border-t border-border/60 p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => toggleShowAll("balances")}
                  >
                    {showAllByTab.balances
                      ? "Show fewer"
                      : `Show all (${balancesRanked.length})`}
                  </Button>
                </div>
              ) : null}

              {!balanceFiltered.length ? (
                <div className="border-t border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No balance changes.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Participants</CardTitle>
              <CardDescription className="text-xs">
                Top addresses by transfer volume
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[340px]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider">
                        Address
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        In
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        Out
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] uppercase tracking-wider text-right">
                        Net
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.participantRows
                      .slice(
                        0,
                        showAllByTab.participants
                          ? stats.participantRows.length
                          : DETAIL_ROW_LIMIT
                      )
                      .map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="px-3 py-2">
                            <AddressText
                              address={p.address}
                              actorLower={actorLower}
                              resolveContractName={resolveContractName}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-success">
                            ${formatUsdCompact(p.inUsd)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-destructive">
                            ${formatUsdCompact(p.outUsd)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-3 py-2 text-right font-mono tabular-nums",
                              p.netUsd >= 0
                                ? "text-success"
                                : "text-destructive"
                            )}
                          >
                            {p.netUsd >= 0 ? "+" : "-"}$
                            {formatUsdCompact(Math.abs(p.netUsd))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {stats.participantRows.length > DETAIL_ROW_LIMIT ? (
                <div className="flex items-center justify-end border-t border-border/60 p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => toggleShowAll("participants")}
                  >
                    {showAllByTab.participants
                      ? "Show fewer"
                      : `Show all (${stats.participantRows.length})`}
                  </Button>
                </div>
              ) : null}

              {!stats.participantRows.length ? (
                <div className="border-t border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No participants.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
