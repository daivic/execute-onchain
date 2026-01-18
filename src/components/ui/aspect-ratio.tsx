import * as React from "react";
import { cn } from "@/lib/utils";

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width / height ratio (e.g. 16 / 9).
   * Defaults to 1 (square).
   */
  ratio?: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = 1, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative w-full overflow-hidden", className)}
        style={{ aspectRatio: ratio, ...style }}
        {...props}
      />
    );
  }
);
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };





