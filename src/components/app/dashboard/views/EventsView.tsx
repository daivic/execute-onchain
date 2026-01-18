import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortenHex, toDisplayString } from "@/lib/format";
import { CopyButton } from "../../shared/CopyButton";
import { ContractAddress } from "../../shared/ContractAddress";
import { useMemo, useState } from "react";
import { BarList, type BarListItem } from "@/components/ui/viz/BarList";
import type { TenderlyLog } from "@/lib/tenderly";

interface EventsTabProps {
  simulationLogs: TenderlyLog[];
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
}

const PAGE_SIZE = 20;

const safeTitle = (title?: string) => {
  if (!title) return undefined;
  if (title.length > 512) return undefined;
  return title;
};

export function EventsView({
  simulationLogs,
  chainId,
  resolveContractName,
}: EventsTabProps) {
  const [eventsShown, setEventsShown] = useState(PAGE_SIZE);

  const eventsFiltered = simulationLogs;

  const eventsVisible = eventsFiltered.slice(0, eventsShown);

  const eventNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of simulationLogs) {
      const name =
        typeof log.name === "string" && log.name.trim() ? log.name : "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [simulationLogs]);

  const eventsTopBarList = useMemo<BarListItem[]>(() => {
    return eventNameCounts.slice(0, 8).map(([name, count]) => ({
      label: name,
      value: count,
    }));
  }, [eventNameCounts]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {eventNameCounts.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {eventNameCounts.slice(0, 3).map(([name, n]) => (
              <Badge
                key={name}
                variant="outline"
                className="h-6 px-2 text-[10px] font-mono text-muted-foreground"
                title={safeTitle(name)}
              >
                {name}
                <span className="ml-1 text-foreground/80">×{n}</span>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {eventsTopBarList.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Top events by count
            </span>
          </div>
          <BarList
            items={eventsTopBarList}
            maxItems={8}
            barClassName="bg-warning"
            showPercentage={false}
          />
        </div>
      )}

      {eventsFiltered.length ? (
        <Accordion type="single" collapsible className="space-y-2">
          {eventsVisible.map((log, i) => {
            const name =
              typeof log.name === "string" && log.name.trim()
                ? log.name
                : `Event ${i + 1}`;
            const addr =
              typeof log.raw?.address === "string"
                ? log.raw.address
                : undefined;
            const inputs = Array.isArray(log.inputs) ? log.inputs : [];
            const topics = Array.isArray(log.raw?.topics) ? log.raw.topics : [];
            const data =
              typeof log.raw?.data === "string" ? log.raw.data : undefined;

            return (
              <AccordionItem
                key={i}
                value={`event-${i}`}
                className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-3 py-3 hover:no-underline">
                  <div className="flex flex-1 items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="font-mono text-xs font-semibold truncate"
                          title={safeTitle(name)}
                        >
                          {name}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] font-mono text-muted-foreground"
                        >
                          {inputs.length} args
                        </Badge>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">
                        {addr ? (
                            <ContractAddress 
                                address={addr} 
                                label={resolveContractName?.(addr)}
                                showCopy={true} 
                                showExplorer={true}
                                className="text-[10px]" 
                                chainId={chainId}
                            />
                        ) : (
                            "—"
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-3 pb-3 space-y-3">
                  {inputs.length ? (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-10 text-xs">
                              Param
                            </TableHead>
                            <TableHead className="h-10 text-xs">Type</TableHead>
                            <TableHead className="h-10 text-xs text-right">
                              Value
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs.map((p, pi) => {
                            const v = toDisplayString(p.value);
                            return (
                              <TableRow key={pi}>
                                <TableCell className="py-2 font-mono text-xs">
                                  {p.name ?? `arg${pi}`}
                                </TableCell>
                                <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                                  {p.type ?? "—"}
                                </TableCell>
                                <TableCell
                                  className="py-2 font-mono text-xs text-right max-w-[320px] truncate"
                                  title={safeTitle(v.title)}
                                >
                                  {v.display}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground text-center">
                      No decoded args.
                    </div>
                  )}

                  {(topics.length || data) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Topics
                          </span>
                          {topics.length ? (
                            <CopyButton
                              text={JSON.stringify(topics)}
                              size="sm"
                            />
                          ) : null}
                        </div>
                        {topics.length ? (
                          <div className="space-y-1">
                            {topics.slice(0, 3).map((t, ti) => (
                              <div
                                key={ti}
                                className="flex items-center justify-between gap-2 text-xs font-mono"
                              >
                                <span className="truncate text-muted-foreground">
                                  {toDisplayString(t).display}
                                </span>
                                <CopyButton text={t} size="sm" />
                              </div>
                            ))}
                            {topics.length > 3 ? (
                              <div className="text-[10px] font-mono text-muted-foreground pt-1">
                                +{topics.length - 3} more
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-mono">
                            —
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Data
                          </span>
                          {data ? <CopyButton text={data} size="sm" /> : null}
                        </div>
                        <div className="text-xs font-mono break-all text-foreground/90">
                          {data ? toDisplayString(data).display : "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 py-10 text-center text-sm text-muted-foreground">
          No events emitted.
        </div>
      )}

      {eventsFiltered.length > eventsVisible.length ? (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEventsShown((s) => s + PAGE_SIZE)}
          >
            Load more
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setEventsShown(eventsFiltered.length)}
          >
            Show all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
