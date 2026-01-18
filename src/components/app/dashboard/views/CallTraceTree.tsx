import * as React from "react";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ContractAddress } from "@/components/app/shared/ContractAddress";
import { formatIntString, hexToBigIntSafe, shortenHex } from "@/lib/format";
import type { TenderlyTraceEntry } from "@/lib/tenderly";

type TraceNode = {
  key: string;
  parentKey: string | null;
  traceAddress: number[];
  depth: number;
  entry: TenderlyTraceEntry;
  methodLabel: string;
  from?: string;
  to?: string;
  gasUsedBi: bigint;
  exclusiveGasUsedBi: bigint;
  children: TraceNode[];
  error?: string;
  /**
   * Tenderly often repeats the same revert/error on every ancestor frame.
   * `errorDisplay` is the single node where we actually show the message/styling.
   */
  errorDisplay?: string;
  /**
   * True if this node or any descendant has an `errorDisplay`, so we can auto-expand
   * down to the actual error without styling every ancestor as an error.
   */
  subtreeHasErrorDisplay?: boolean;
};

export type CallTraceTreeValueMode = "exclusive" | "inclusive";

export interface CallTraceTreeProps {
  trace: TenderlyTraceEntry[];
  totalGas?: bigint;
  valueMode?: CallTraceTreeValueMode;
  defaultExpandedDepth?: number;
  highlightAddresses?: Set<string>;
  selectedKey?: string;
  onSelectKey?: (key: string) => void;
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
  className?: string;
}

const safeTitle = (title?: string) => {
  if (!title) return undefined;
  if (title.length > 512) return undefined;
  return title;
};

function buildTree(trace: TenderlyTraceEntry[]): {
  roots: TraceNode[];
  byKey: Map<string, TraceNode>;
} {
  const nodesByKey = new Map<string, TraceNode>();
  const childrenByKey = new Map<string, string[]>();

  for (const entry of trace) {
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

    const gasUsedBi = hexToBigIntSafe(entry.gasUsed) ?? 0n;

    const from = typeof entry.from === "string" ? entry.from : undefined;
    const to = typeof entry.to === "string" ? entry.to : undefined;

    const error = typeof entry.error === "string" ? entry.error : undefined;

    nodesByKey.set(key, {
      key,
      parentKey,
      traceAddress,
      depth: traceAddress.length,
      entry,
      methodLabel,
      from,
      to,
      gasUsedBi,
      exclusiveGasUsedBi: 0n,
      children: [],
      error,
    });

    if (parentKey) {
      const existing = childrenByKey.get(parentKey) ?? [];
      existing.push(key);
      childrenByKey.set(parentKey, existing);
    }
  }

  // Attach children arrays.
  for (const [parentKey, childKeys] of childrenByKey.entries()) {
    const parent = nodesByKey.get(parentKey);
    if (!parent) continue;
    parent.children = childKeys
      .map((k) => nodesByKey.get(k))
      .filter((n): n is TraceNode => Boolean(n))
      .sort((a, b) => {
        const ai = a.traceAddress[a.traceAddress.length - 1] ?? 0;
        const bi = b.traceAddress[b.traceAddress.length - 1] ?? 0;
        return ai - bi;
      });
  }

  // Exclusive gas = gasUsed - sum(direct children gasUsed)
  for (const node of nodesByKey.values()) {
    let childrenGas = 0n;
    for (const child of node.children) childrenGas += child.gasUsedBi;
    node.exclusiveGasUsedBi =
      node.gasUsedBi > childrenGas ? node.gasUsedBi - childrenGas : 0n;
  }

  const roots = Array.from(nodesByKey.values())
    .filter((n) => n.parentKey === null)
    .sort((a, b) => a.depth - b.depth);

  // Tenderly can propagate the same error string up the stack. We only display
  // the error on the deepest frame(s) where it originates (no direct child errored),
  // then mark ancestors so the UI can auto-expand down to it.
  for (const node of nodesByKey.values()) {
    const childHasError = node.children.some((c) => Boolean(c.error));
    node.errorDisplay = node.error && !childHasError ? node.error : undefined;
  }

  const nodesByDepthDesc = Array.from(nodesByKey.values()).sort(
    (a, b) => b.depth - a.depth
  );
  for (const node of nodesByDepthDesc) {
    const childHasDisplay = node.children.some(
      (c) => Boolean(c.subtreeHasErrorDisplay) || Boolean(c.errorDisplay)
    );
    node.subtreeHasErrorDisplay = Boolean(node.errorDisplay) || childHasDisplay;
  }

  return { roots, byKey: nodesByKey };
}

function formatPct(part: bigint, total: bigint) {
  if (total <= 0n) return 0;
  const basisPoints = (part * 10000n) / total;
  return Number(basisPoints) / 100;
}

function AddressMini({
  address,
  chainId,
  resolveContractName,
}: {
  address?: string;
  chainId?: number;
  resolveContractName?: (address?: string) => string | undefined;
}) {
  if (!address) return null;
  const isHex = address.startsWith("0x") && address.length > 10;

  if (!isHex) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground">
        {address}
      </span>
    );
  }

  return (
    <ContractAddress
      address={address}
      chainId={chainId}
      label={resolveContractName?.(address)}
      className="text-[10px] text-muted-foreground"
      showCopy={true}
      showExplorer={true}
    />
  );
}

function Chevron({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
  );
}

export function CallTraceTree({
  trace,
  totalGas,
  valueMode = "exclusive",
  defaultExpandedDepth = 1,
  highlightAddresses,
  selectedKey,
  onSelectKey,
  chainId,
  resolveContractName,
  className,
}: CallTraceTreeProps) {
  const tree = React.useMemo(() => buildTree(trace), [trace]);
  const computedTotal = React.useMemo(() => {
    if (typeof totalGas === "bigint") return totalGas;
    // Fallback: sum exclusive across all nodes.
    let sum = 0n;
    for (const n of tree.byKey.values()) sum += n.exclusiveGasUsedBi;
    return sum;
  }, [totalGas, tree.byKey]);

  const highlight = React.useMemo(() => {
    return highlightAddresses
      ? new Set(Array.from(highlightAddresses).map((a) => a.toLowerCase()))
      : undefined;
  }, [highlightAddresses]);

  function Row({ node }: { node: TraceNode }) {
    const hasChildren = node.children.length > 0;
    const isHighlighted =
      highlight &&
      ((node.to && highlight.has(node.to.toLowerCase())) ||
        (node.from && highlight.has(node.from.toLowerCase())));
    const isSelected = selectedKey === node.key;
    const isErrorOrigin = Boolean(node.errorDisplay);
    const hasDownstreamError =
      Boolean(node.subtreeHasErrorDisplay) && !isErrorOrigin;

    const value =
      valueMode === "inclusive" ? node.gasUsedBi : node.exclusiveGasUsedBi;
    const pct = formatPct(value, computedTotal);
    const toLabel = node.to
      ? resolveContractName?.(node.to) ?? shortenHex(node.to)
      : "—";
    const toTitle = node.to
      ? resolveContractName?.(node.to)
        ? `${resolveContractName(node.to)} · ${node.to}`
        : node.to
      : undefined;

    // Animate bar on mount (entry), not continuously.
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
      const t = window.setTimeout(() => setMounted(true), 0);
      return () => window.clearTimeout(t);
    }, []);

    // Auto-expand down to the actual error origin, without treating every ancestor as "the error".
    const [open, setOpen] = React.useState(
      node.depth < defaultExpandedDepth || Boolean(node.subtreeHasErrorDisplay)
    );
    const indent = Math.min(node.depth, 10) * 12;

    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="relative">
          <button
            type="button"
            className={cn(
              "group w-full text-left",
              "rounded-lg px-2.5 py-2",
              "hover:bg-muted/40 transition-colors",
              isSelected && "bg-muted/50",
              isHighlighted && "ring-1 ring-primary/20",
              isErrorOrigin && "bg-destructive/10 hover:bg-destructive/20"
            )}
            style={{ paddingLeft: indent + 10 }}
            onClick={() => {
              if (hasChildren) setOpen((o) => !o);
              onSelectKey?.(node.key);
            }}
          >
            {/* Bar backdrop */}
            <div className="absolute inset-y-0 left-0 right-0 -z-10 overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-transparent" />
              <div
                className={cn(
                  "absolute left-0 top-0 h-full",
                  isErrorOrigin
                    ? "bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent"
                    : "bg-gradient-to-r from-primary/18 via-primary/10 to-transparent"
                )}
                style={{
                  width: `${mounted ? Math.min(pct, 100) : 0}%`,
                  transition: "width 500ms ease",
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {hasChildren ? <Chevron open={open} /> : null}
                  {hasDownstreamError ? (
                    <AlertCircle className="h-3 w-3 text-destructive/60" />
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold truncate",
                      isHighlighted && "text-primary",
                      isErrorOrigin && "text-destructive"
                    )}
                    title={safeTitle(node.methodLabel)}
                  >
                    {node.methodLabel}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span
                    className="font-mono text-xs truncate text-foreground/90"
                    title={safeTitle(toTitle)}
                  >
                    {toLabel}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <AddressMini
                    address={node.from}
                    chainId={chainId}
                    resolveContractName={resolveContractName}
                  />
                  {node.from || node.to ? (
                    <span className="text-muted-foreground text-[10px]">
                      {" "}
                      •{" "}
                    </span>
                  ) : null}
                  <AddressMini
                    address={node.to}
                    chainId={chainId}
                    resolveContractName={resolveContractName}
                  />
                </div>
                {isErrorOrigin ? (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="font-mono break-all">
                      {node.errorDisplay}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {value > 0n ? formatIntString(value.toString()) : "—"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {pct > 0 ? `${pct.toFixed(2)}%` : "—"}
                </div>
              </div>
            </div>
          </button>

          {hasChildren ? (
            <CollapsibleContent className="pl-2">
              <div className="mt-1 space-y-1">
                {node.children.map((child) => (
                  <Row key={child.key} node={child} />
                ))}
              </div>
            </CollapsibleContent>
          ) : null}
        </div>
      </Collapsible>
    );
  }

  if (!trace.length) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {tree.roots.map((node) => (
        <Row key={node.key} node={node} />
      ))}
    </div>
  );
}
