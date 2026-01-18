import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          "inline-flex",
          orientation === "horizontal"
            ? "flex-row [&>button:not(:first-child)]:border-l-0 [&>button:not(:first-child)]:rounded-l-none [&>button:not(:last-child)]:rounded-r-none"
            : "flex-col [&>button:not(:first-child)]:border-t-0 [&>button:not(:first-child)]:rounded-t-none [&>button:not(:last-child)]:rounded-b-none",
          className
        )}
        {...props}
      />
    );
  }
);
ButtonGroup.displayName = "ButtonGroup";

const ButtonGroupSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
  }
>(({ className, orientation = "vertical", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-border",
        orientation === "horizontal"
          ? "h-px w-full"
          : "h-full w-px",
        className
      )}
      {...props}
    />
  );
});
ButtonGroupSeparator.displayName = "ButtonGroupSeparator";

const ButtonGroupText = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean;
  }
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? React.Fragment : "div";
  return (
    <Comp
      ref={asChild ? undefined : ref}
      className={cn(
        !asChild && "px-3 py-1.5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});
ButtonGroupText.displayName = "ButtonGroupText";

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };

