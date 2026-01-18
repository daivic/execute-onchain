import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface BarListItem {
  label: ReactNode;
  value: number;
  percentage?: number;
  rightLabel?: string;
  leading?: ReactNode;
  onClick?: () => void;
}

interface BarListProps {
  items: BarListItem[];
  maxItems?: number;
  className?: string;
  barClassName?: string;
  showPercentage?: boolean;
}

export function BarList({
  items,
  maxItems = 8,
  className,
  barClassName,
  showPercentage = true,
}: BarListProps) {
  const displayItems = items.slice(0, maxItems);
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cn("space-y-2", className)}>
      {displayItems.map((item, i) => {
        const widthPercent = (item.value / maxValue) * 100;
        const percentage = item.percentage ?? (item.value / maxValue) * 100;
        const right =
          item.rightLabel ??
          (showPercentage
            ? `${percentage.toFixed(1)}%`
            : item.value.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }));

        return (
          <div
            key={i}
            className={cn(
              "group flex items-center gap-3 text-xs",
              item.onClick && "cursor-pointer hover:opacity-80 transition-opacity"
            )}
            onClick={item.onClick}
          >
            {item.leading ? (
              <div className="shrink-0 flex items-center">{item.leading}</div>
            ) : null}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-medium truncate text-foreground">
                  {item.label}
                </div>
                <span className="font-mono text-muted-foreground shrink-0">
                  {right}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    barClassName || "bg-primary"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


