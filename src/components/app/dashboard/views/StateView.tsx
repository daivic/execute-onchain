import * as React from "react";
import {
  Database,
  Wallet,
  Hash,
  Layers,
  TrendingUp,
  TrendingDown,
  ArrowUp,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BarList, type BarListItem } from "@/components/ui/viz/BarList";
import { DashboardMetric } from "@/components/ui/viz/DashboardMetric";
import { ContractAddress } from "../../shared/ContractAddress";
import type { TenderlyStateChange } from "@/lib/tenderly";
import {
  formatHexToDecimal,
  hexToBigIntSafe,
  formatIntString,
  shortenHex,
  formatEthValue,
} from "@/lib/format";
import { formatEther } from "viem";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StateTabProps {
  simulationStateChanges: TenderlyStateChange[];
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
}

export function StateView({
  simulationStateChanges,
  chainId,
  resolveContractName,
}: StateTabProps) {
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  const stats = React.useMemo(() => {
    let totalSlots = 0;
    let balanceChanges = 0;
    let nonceChanges = 0;
    const addresses = new Set<string>();

    const storageByAddress: { address: string; slots: number }[] = [];

    for (const change of simulationStateChanges) {
      if (change.address) addresses.add(change.address);
      if (change.storage) {
        totalSlots += change.storage.length;
        storageByAddress.push({
          address: change.address || "Unknown",
          slots: change.storage.length,
        });
      }
      if (change.balance) balanceChanges++;
      if (change.nonce) nonceChanges++;
    }

    storageByAddress.sort((a, b) => b.slots - a.slots);

    return {
      totalSlots,
      balanceChanges,
      nonceChanges,
      uniqueAddresses: addresses.size,
      storageByAddress,
    };
  }, [simulationStateChanges]);

  const storageBarList: BarListItem[] = React.useMemo(
    () =>
      stats.storageByAddress.slice(0, 8).map((item) => ({
        label: (
          <ContractAddress
            address={item.address}
            chainId={chainId}
            label={resolveContractName?.(item.address)}
            showCopy={true}
            showExplorer={true}
          />
        ),
        value: item.slots,
        rightLabel: `${item.slots} slots`,
      })),
    [stats.storageByAddress, chainId]
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetric
          title="Total Storage Writes"
          value={stats.totalSlots}
          subValue="Slots modified across all contracts"
          badgeIcon={<Database className="size-3" />}
          badgeText="Storage"
        />
        <DashboardMetric
          title="Addresses Touched"
          value={stats.uniqueAddresses}
          subValue="Unique contracts or EOAs modified"
          badgeIcon={<Layers className="size-3" />}
          badgeText="Scope"
        />
        <DashboardMetric
          title="Balance Updates"
          value={stats.balanceChanges}
          subValue="Native ETH balance changes"
          badgeIcon={<Wallet className="size-3" />}
          badgeText="Value"
        />
        <DashboardMetric
          title="Nonce Updates"
          value={stats.nonceChanges}
          subValue="Transaction count increments"
          badgeIcon={<Hash className="size-3" />}
          badgeText="Nonces"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Top Storage Writers */}
        <Card className="overflow-hidden lg:col-span-1">
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm">Top Storage Writers</CardTitle>
            <CardDescription className="text-xs">
              Contracts with the most storage slot updates
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {storageBarList.length ? (
              <BarList
                items={storageBarList}
                maxItems={8}
                showPercentage={false}
                barClassName="bg-primary/60"
              />
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No storage writes.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Changes */}
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm">State Change Details</CardTitle>
            <CardDescription className="text-xs">
              Breakdown of storage, balance, and nonce changes per address
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[400px]">
              {simulationStateChanges.length ? (
                <Accordion
                  type="multiple"
                  value={openItems}
                  onValueChange={setOpenItems}
                  className="space-y-2 pr-3"
                >
                  {simulationStateChanges.map((change, i) => {
                    // Balance Logic
                    const prevBal = hexToBigIntSafe(
                      change.balance?.previousValue
                    );
                    const nextBal = hexToBigIntSafe(change.balance?.newValue);
                    const balDelta =
                      prevBal !== undefined && nextBal !== undefined
                        ? nextBal - prevBal
                        : 0n;
                    const balDeltaFormatted =
                      balDelta === 0n
                        ? "0"
                        : `${balDelta > 0n ? "+" : "-"}${formatEthValue(
                            balDelta < 0n ? -balDelta : balDelta
                          )}`;

                    // Nonce Logic
                    const prevNonce = hexToBigIntSafe(
                      change.nonce?.previousValue
                    );
                    const nextNonce = hexToBigIntSafe(change.nonce?.newValue);
                    const nonceDelta =
                      prevNonce !== undefined && nextNonce !== undefined
                        ? nextNonce - prevNonce
                        : 0n;
                    const nonceDeltaFormatted =
                      nonceDelta === 0n
                        ? "0"
                        : `${nonceDelta > 0n ? "+" : ""}${formatIntString(
                            nonceDelta.toString()
                          )}`;

                    // Storage Logic
                    const storageCount = change.storage?.length ?? 0;

                    const addressLabel = change.address
                      ? change.address
                      : `Address ${i + 1}`;

                    return (
                      <AccordionItem
                        key={i}
                        value={`item-${i}`}
                        className="border-0 bg-transparent"
                      >
                        <div className="rounded-lg border border-border/40 bg-card/40 overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:bg-muted/5 transition-colors">
                            <div className="flex items-center gap-2">
                              <ContractAddress
                                address={change.address || ""}
                                chainId={chainId}
                                label={resolveContractName?.(change.address)}
                                className="font-semibold text-sm"
                                showCopy={true}
                                showExplorer={true}
                              />
                              {(balDelta !== 0n ||
                                nonceDelta !== 0n ||
                                storageCount > 0) && (
                                <span className="ml-2 flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {balDelta !== 0n && (
                                    <span className="flex items-center gap-1">
                                      <Wallet className="size-3" />
                                      Bal
                                    </span>
                                  )}
                                  {nonceDelta !== 0n && (
                                    <span className="flex items-center gap-1">
                                      <Hash className="size-3" />
                                      Nonce
                                    </span>
                                  )}
                                  {storageCount > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Database className="size-3" />
                                      {storageCount}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-0">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mt-2">
                              <DashboardMetric
                                title="Balance Change"
                                value={balDeltaFormatted}
                                subValue={
                                  change.balance
                                    ? `${formatEthValue(
                                        prevBal ?? 0n
                                      )} → ${formatEthValue(nextBal ?? 0n)}`
                                    : "No change"
                                }
                                badgeIcon={
                                  balDelta > 0n ? (
                                    <TrendingUp className="size-3" />
                                  ) : balDelta < 0n ? (
                                    <TrendingDown className="size-3" />
                                  ) : undefined
                                }
                                badgeText={
                                  balDelta > 0n
                                    ? "Increase"
                                    : balDelta < 0n
                                    ? "Decrease"
                                    : undefined
                                }
                                badgeVariant={
                                  balDelta > 0n
                                    ? "outline"
                                    : balDelta < 0n
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="bg-gradient-to-t from-muted/5 to-muted/10 border-border/40 shadow-none"
                              />
                              <DashboardMetric
                                title="Nonce Change"
                                value={nonceDeltaFormatted}
                                subValue={
                                  change.nonce
                                    ? `${
                                        formatHexToDecimal(
                                          change.nonce.previousValue
                                        ) ?? 0
                                      } → ${
                                        formatHexToDecimal(
                                          change.nonce.newValue
                                        ) ?? 0
                                      }`
                                    : "No change"
                                }
                                badgeIcon={
                                  nonceDelta > 0n ? (
                                    <ArrowUp className="size-3" />
                                  ) : undefined
                                }
                                badgeText={nonceDelta > 0n ? "Inc" : undefined}
                                badgeVariant={
                                  nonceDelta > 0n ? "outline" : "secondary"
                                }
                                className="bg-gradient-to-t from-muted/5 to-muted/10 border-border/40 shadow-none"
                              />
                              <DashboardMetric
                                title="Storage Slots"
                                value={storageCount}
                                subValue={
                                  storageCount > 0
                                    ? "Slots modified"
                                    : "No updates"
                                }
                                badgeIcon={
                                  storageCount > 0 ? (
                                    <Database className="size-3" />
                                  ) : undefined
                                }
                                badgeText={
                                  storageCount > 0 ? "Modified" : undefined
                                }
                                badgeVariant={
                                  storageCount > 0 ? "outline" : "secondary"
                                }
                                className="bg-gradient-to-t from-muted/5 to-muted/10 border-border/40 shadow-none"
                              />
                            </div>
                          </AccordionContent>
                        </div>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-muted-foreground text-sm">
                  No state changes recorded.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
