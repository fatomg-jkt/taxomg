import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-masterplan-ink/15 bg-masterplan-bone px-3 py-2 text-sm font-medium text-masterplan-ink outline-none transition-colors focus-visible:border-masterplan-blue focus-visible:ring-2 focus-visible:ring-masterplan-blue/25",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
