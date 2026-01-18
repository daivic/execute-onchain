import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardMetricProps {
  title: ReactNode;
  value: ReactNode;
  subValue?: ReactNode;
  badge?: ReactNode;
  badgeIcon?: ReactNode;
  badgeText?: ReactNode;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  contentClassName?: string;
}

export function DashboardMetric({
  title,
  value,
  subValue,
  badge,
  badgeIcon,
  badgeText,
  badgeVariant = "outline",
  className,
  contentClassName,
}: DashboardMetricProps) {
  return (
    <Card className={cn("@container/card bg-gradient-to-t from-primary/5 to-card", className)}>
      <CardHeader className="relative">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        {(badge || (badgeText && badgeIcon)) && (
          <div className="absolute right-4 top-4">
            {badge ? (
              badge
            ) : (
              <Badge
                variant={badgeVariant}
                className="flex gap-1 rounded-lg text-xs"
              >
                {badgeIcon}
                {badgeText}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      {subValue && (
        <CardContent className={cn("pt-0 text-sm text-muted-foreground", contentClassName)}>
          {subValue}
        </CardContent>
      )}
    </Card>
  );
}








