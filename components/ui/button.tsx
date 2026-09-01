import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masterplan-blue focus-visible:ring-offset-2 focus-visible:ring-offset-masterplan-bone disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "rounded-full border border-masterplan-acid bg-masterplan-acid px-5 text-masterplan-ink hover:brightness-95",
        secondary: "rounded-xl border border-masterplan-ink/15 bg-transparent px-4 text-masterplan-ink hover:bg-masterplan-ink/5",
        outline: "rounded-xl border border-masterplan-ink/20 bg-transparent px-4 text-masterplan-ink hover:bg-masterplan-ink/5",
        ghost: "rounded-xl bg-transparent px-4 text-masterplan-ink hover:bg-masterplan-ink/5",
        destructive: "rounded-full border border-masterplan-magenta bg-masterplan-magenta px-5 text-white hover:brightness-95",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-11 px-4",
        lg: "h-12 px-7",
        icon: "h-11 w-11 rounded-xl px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
));
Button.displayName = "Button";
