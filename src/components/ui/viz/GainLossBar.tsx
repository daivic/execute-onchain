import { cn } from "@/lib/utils";

interface GainLossBarProps {
  inflow: number;
  outflow: number;
  className?: string;
  labelIn?: string;
  labelOut?: string;
  formatValue?: (v: number) => string;
}

export function GainLossBar({
  inflow,
  outflow,
  className,
  labelIn = "In",
  labelOut = "Out",
  formatValue = (v) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 2 }),
}: GainLossBarProps) {
  const max = Math.max(inflow, outflow, 1);
  const inPct = (inflow / max) * 100;
  const outPct = (outflow / max) * 100;
  const net = inflow - outflow;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>
          {labelOut} ${formatValue(outflow)}
        </span>
        <span className={cn(net >= 0 ? "text-success" : "text-destructive")}>
          Net {net >= 0 ? "+" : "-"}${formatValue(Math.abs(net))}
        </span>
        <span>
          {labelIn} ${formatValue(inflow)}
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-1 h-3">
        <div className="relative rounded-full bg-muted overflow-hidden">
          <div
            className="absolute right-0 top-0 h-full rounded-full bg-destructive/30"
            style={{ width: `${outPct}%` }}
          />
        </div>
        <div className="relative rounded-full bg-muted overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-success/30"
            style={{ width: `${inPct}%` }}
          />
        </div>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-3 w-px bg-border" />
      </div>
    </div>
  );
}




