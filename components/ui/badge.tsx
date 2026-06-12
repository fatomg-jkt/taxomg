import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary dark:bg-primary/20",
      success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      destructive: "bg-destructive/10 text-destructive dark:text-red-300",
      secondary: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
