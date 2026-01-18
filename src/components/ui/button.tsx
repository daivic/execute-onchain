import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        simpleGhost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        simulate:
          "border border-tenderly/25 bg-tenderly/10 text-tenderly hover:bg-tenderly/15",
        tenderly:
          "[--button-shadow:var(--shadow-tenderly)] bg-gradient-to-b from-tenderly to-tenderly/85 text-tenderly-foreground border border-white/15 hover:to-tenderly/75",
        execute:
          "[--button-shadow:var(--shadow-primary)] relative overflow-hidden bg-gradient-to-b from-primary to-primary/80 text-primary-foreground border border-white/20 ring-1 ring-primary/30 drop-shadow-[0_18px_18px_hsl(var(--primary)_/_0.25)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_20%,hsl(var(--neutral-50)_/_0.6),transparent_55%)] before:opacity-70 before:content-[''] hover:to-primary/70",
        shadowOutline:
          "[--button-shadow:var(--shadow-primary)] bg-card/60 backdrop-blur-md border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
