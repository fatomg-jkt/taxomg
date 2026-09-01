import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full px-0 py-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-masterplan-ink before:block before:h-2 before:w-2 before:shrink-0 before:rounded-full",
  {
    variants: {
      variant: {
        default: "before:bg-masterplan-blue",
        success: "before:bg-masterplan-acid",
        warning: "before:bg-masterplan-sage",
        destructive: "before:bg-masterplan-magenta",
        secondary: "before:bg-masterplan-plum",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
