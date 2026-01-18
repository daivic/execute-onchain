import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function MetricCard({
  label,
  value,
  description,
  icon,
  className,
  labelClassName,
  valueClassName,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        // Keep this consistent with `Card`: subtle glass surface + a single, neutral highlight.
        "relative overflow-hidden rounded-xl border border-border/60 bg-card/70 text-card-foreground backdrop-blur-xl shadow-sm ring-1 ring-white/25",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:content-[''] before:bg-gradient-to-b before:from-white/55 before:to-transparent before:opacity-30",
        "p-3 sm:p-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 shrink-0 rounded-md border bg-muted/20 p-1.5 text-foreground/80">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              labelClassName
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-base font-bold leading-none text-foreground sm:text-lg",
              valueClassName
            )}
          >
            {value}
          </div>
          {description ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

