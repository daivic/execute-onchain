import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpIconTooltipProps {
  content: string;
  size?: "sm" | "md";
  className?: string;
}

export function HelpIconTooltip({
  content,
  size = "md",
  className,
}: HelpIconTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle
            className={cn(
              size === "sm"
                ? "h-3 w-3 text-muted-foreground/50"
                : "h-4 w-4 text-muted-foreground",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
