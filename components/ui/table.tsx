import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto"><table ref={ref} className={cn("w-full border-collapse caption-bottom bg-transparent text-sm text-masterplan-ink", className)} {...props} /></div>
));
Table.displayName = "Table";
export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <thead ref={ref} className={cn("border-y border-masterplan-ink/20", className)} {...props} />);
TableHeader.displayName = "TableHeader";
export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />);
TableBody.displayName = "TableBody";
export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => <tr ref={ref} className={cn("border-b border-masterplan-ink/10 transition-colors hover:bg-masterplan-acid/10", className)} {...props} />);
TableRow.displayName = "TableRow";
export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <th ref={ref} className={cn("h-12 px-4 text-left align-middle font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-masterplan-plum", className)} {...props} />);
TableHead.displayName = "TableHead";
export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <td ref={ref} className={cn("p-4 align-middle text-masterplan-ink", className)} {...props} />);
TableCell.displayName = "TableCell";
