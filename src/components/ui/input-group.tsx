import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, InputProps } from "@/components/ui/input";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Button, ButtonProps } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center min-w-0 rounded-lg border border-input bg-background transition-all focus-within:border-primary focus-within:ring-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
InputGroup.displayName = "InputGroup";

interface InputGroupAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "inline-start" | "inline-end" | "block-start" | "block-end";
}

const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = "inline-start", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center px-2 h-10 text-sm font-medium text-foreground select-none whitespace-nowrap",
          align === "inline-end" && "order-last border-l border-input",
          align === "block-start" && "order-first border-b border-input",
          align === "block-end" && "order-last border-t border-input",
          className
        )}
        {...props}
      />
    );
  }
);
InputGroupAddon.displayName = "InputGroupAddon";

const InputGroupInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn("rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0", className)}
        {...props}
      />
    );
  }
);
InputGroupInput.displayName = "InputGroupInput";

const InputGroupTextarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ className, ...props }, ref) => {
  return (
    <Textarea
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
      {...props}
    />
  );
});
InputGroupTextarea.displayName = "InputGroupTextarea";

const inputGroupButtonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [--button-shadow:var(--shadow-neutral)] shadow-[0_2px_0_0_var(--button-shadow)] hover:shadow-[0_3px_0_0_var(--button-shadow)] hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-none",
  {
    variants: {
      variant: {
        default:
          "[--button-shadow:var(--shadow-primary)] bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "[--button-shadow:var(--shadow-destructive)] bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "[--button-shadow:var(--shadow-primary)] border border-primary/25 bg-card hover:bg-primary/5 hover:text-primary",
        secondary:
          "[--button-shadow:var(--shadow-neutral)] bg-transparent border border-border/70 text-foreground hover:border-primary/20 hover:bg-primary/5",
        ghost:
          "[--button-shadow:var(--shadow-neutral)] hover:bg-primary/5 hover:text-primary",
        link: "shadow-none hover:shadow-none active:shadow-none hover:translate-y-0 active:translate-y-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2 rounded-md",
        "icon-xs": "h-7 w-7 rounded-md",
        sm: "h-8 px-2.5 rounded-md",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "xs",
    },
  }
);

interface InputGroupButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof inputGroupButtonVariants> {}

const InputGroupButton = React.forwardRef<
  HTMLButtonElement,
  InputGroupButtonProps
>(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(inputGroupButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
});
InputGroupButton.displayName = "InputGroupButton";

export {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
  InputGroupButton,
};
