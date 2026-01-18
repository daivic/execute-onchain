import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Send } from "lucide-react";
import type { ComponentProps } from "react";

type ExecuteButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "children"
> & {
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
};

export function ExecuteButton({
  isLoading = false,
  label = "Execute Transaction",
  loadingLabel = "Executing...",
  className,
  ...props
}: ExecuteButtonProps) {
  return (
    <Button
      variant="execute"
      size="lg"
      className={cn(
        "h-12 text-base font-semibold gap-2 active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Send className="h-5 w-5" />
      )}
      {isLoading ? loadingLabel : label}
    </Button>
  );
}
