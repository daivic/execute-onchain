import { cn } from "@/lib/utils";

interface AreaSparklineProps {
  data: number[];
  className?: string;
  height?: number;
  color?: string;
}

export function AreaSparkline({
  data,
  className,
  height = 40,
  color = "currentColor",
}: AreaSparklineProps) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const padding = 2;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(" L ")} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2)}`;
  const useCurrentColor = color.includes("var(") || color === "currentColor";

  return (
    <div
      className={cn("relative", className)}
      style={useCurrentColor ? { color } : undefined}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={useCurrentColor ? "currentColor" : color}
              stopOpacity={0.3}
            />
            <stop
              offset="100%"
              stopColor={useCurrentColor ? "currentColor" : color}
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <path
          d={pathData}
          fill={`url(#${gradientId})`}
          className="transition-opacity hover:opacity-80"
        />
        <path
          d={`M ${points.join(" L ")}`}
          fill="none"
          stroke={useCurrentColor ? "currentColor" : color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-opacity hover:opacity-80"
        />
      </svg>
    </div>
  );
}

