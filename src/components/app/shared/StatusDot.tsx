import { cn } from "@/lib/utils";

export function StatusDot({
  status,
}: {
  status: "off" | "ok" | "warn" | "bad" | "info" | "tenderly";
}) {
  const colorClass = {
    off: "bg-muted-foreground/30",
    ok: "bg-success",
    warn: "bg-warning",
    bad: "bg-destructive",
    info: "bg-info",
    tenderly: "bg-tenderly",
  }[status];

  const ringClass = {
    off: "ring-muted-foreground/10",
    ok: "ring-success/20",
    warn: "ring-warning/20",
    bad: "ring-destructive/20",
    info: "ring-info/20",
    tenderly: "ring-tenderly/20",
  }[status];

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full ring-2 ring-offset-2 ring-offset-card",
        colorClass,
        ringClass
      )}
    />
  );
}

