import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-xl border border-masterplan-ink/15 bg-masterplan-bone px-3 py-2 text-sm text-masterplan-ink outline-none transition-colors file:mr-3 file:rounded-full file:border-0 file:bg-masterplan-acid file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-masterplan-ink placeholder:text-masterplan-ink/45 focus-visible:border-masterplan-blue focus-visible:ring-2 focus-visible:ring-masterplan-blue/25 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
