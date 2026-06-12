"use client";

import { useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, CheckCircle2, Database, Download, FileArchive, FileSpreadsheet, FileText, Loader2, Menu, Moon, ReceiptText, Search, ShieldAlert, Sun, Upload, XCircle } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { companies, formatCurrency, formatDate, generateDocuments, generateTaxStatusRows, generateVatCalculations, periods, type Company, type TaxDocument, type TaxStatus, type TaxStatusRow, type VatCalculation } from "@/lib/tax-data";

const navItems = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "PPN", icon: ReceiptText },
  { label: "PPh Pasal 21", icon: FileText },
  { label: "PPh Unifikasi", icon: FileArchive },
  { label: "PBB", icon: Building2 },
  { label: "UMKM", icon: Database },
  { label: "Tax Documents", icon: FileSpreadsheet },
];

const chartColors = ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444"];

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary";

function statusVariant(status: TaxStatus | TaxDocument["status"]): BadgeVariant {
  if (status === "Filed" || status === "Validated" || status === "Archived") return "success";
  if (status === "Due Soon" || status === "In Review" || status === "Needs Review") return "warning";
  if (status === "Overdue" || status === "Missing Docs" || status === "Missing") return "destructive";
  return "secondary";
}

function toCsv<T extends Record<string, unknown>>(rows: T[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
      <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function TaxCoordinatorDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [selectedCompany, setSelectedCompany] = useState<Company>(companies[0]);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState("No files uploaded in this session.");
  const { theme, setTheme } = useTheme();
  const excelInputRef = useRef<HTMLInputElement>(null);

  const taxRows = useMemo(() => generateTaxStatusRows(), []);
  const vatRows = useMemo(() => generateVatCalculations(), []);
  const documents = useMemo(() => generateDocuments(), []);

  const filteredTaxRows = useMemo(
    () => taxRows.filter((row) => (selectedCompany === "All Companies" || row.company === selectedCompany) && row.period === selectedPeriod),
    [selectedCompany, selectedPeriod, taxRows],
  );

  const filteredVatRows = useMemo(
    () => vatRows.filter((row) => (selectedCompany === "All Companies" || row.company === selectedCompany) && row.taxPeriod === selectedPeriod),
    [selectedCompany, selectedPeriod, vatRows],
  );

  const filteredDocuments = useMemo(
    () => documents.filter((document) => selectedCompany === "All Companies" || document.company === selectedCompany),
    [documents, selectedCompany],
  );

  const totals = useMemo(() => {
    const sourceRows = filteredVatRows.length ? filteredVatRows : vatRows.filter((row) => selectedCompany === "All Companies" || row.company === selectedCompany);
    const output = sourceRows.reduce((sum, row) => sum + row.outputVat, 0);
    const input = sourceRows.reduce((sum, row) => sum + row.inputVat, 0);
    const nonCreditable = Math.round(input * 0.075);
    return { output, input, kbLb: output - input, nonCreditable };
  }, [filteredVatRows, selectedCompany, vatRows]);

  const chartData = [
    { name: "Output VAT", value: totals.output },
    { name: "Input VAT", value: totals.input },
    { name: "KB/LB", value: Math.abs(totals.kbLb) },
    { name: "Non-creditable", value: totals.nonCreditable },
  ];

  const alertItems = [
    { icon: CalendarDays, title: "Upcoming Due Dates", description: `${filteredTaxRows.filter((row) => row.status === "Due Soon").length || 2} filings due within 7 days`, variant: "warning" as BadgeVariant },
    { icon: AlertTriangle, title: "Missing Documents", description: `${filteredDocuments.filter((doc) => doc.status === "Missing").length} document packets incomplete`, variant: "destructive" as BadgeVariant },
    { icon: CheckCircle2, title: "Filing Status", description: `${filteredTaxRows.filter((row) => row.status === "Filed").length} obligations filed for ${selectedPeriod}`, variant: "success" as BadgeVariant },
    { icon: Bell, title: "Upload Queue", description: uploadMessage, variant: "default" as BadgeVariant },
  ];

  const statusColumns = useMemo<ColumnDef<TaxStatusRow>[]>(
    () => [
      { accessorKey: "taxType", header: "Tax Type" },
      { accessorKey: "period", header: "Period" },
      { accessorKey: "dueDate", header: "Due Date", cell: ({ row }) => formatDate(row.original.dueDate) },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.amount)}</span> },
    ],
    [],
  );

  const statusTable = useReactTable({ data: filteredTaxRows, columns: statusColumns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  function simulateUpload(file: File | undefined, type: string) {
    if (!file) return;
    setLoading(true);
    setError(null);
    window.setTimeout(() => {
      if (file.size > 8 * 1024 * 1024) {
        setError(`${file.name} exceeds the 8 MB upload limit for demo processing.`);
      } else {
        setUploadMessage(`${type} uploaded: ${file.name} • ${(file.size / 1024).toFixed(1)} KB • queued for validation`);
      }
      setLoading(false);
    }, 650);
  }

  function exportCsv() {
    const rows = filteredVatRows.map((row) => ({ Company: row.company, TaxPeriod: row.taxPeriod, OutputVAT: row.outputVat, InputVAT: row.inputVat, KBLB: row.kbLb, NTPN: row.ntpn }));
    downloadBlob(`tax-dashboard-${selectedPeriod.toLowerCase().replace(" ", "-")}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filteredVatRows), "VAT Calculation");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filteredTaxRows), "Tax Status");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filteredDocuments), "Documents");
    XLSX.writeFile(workbook, `tax-coordinator-${selectedPeriod.toLowerCase().replace(" ", "-")}.xlsx`);
  }

  const Sidebar = (
    <aside className="flex h-full flex-col border-r bg-card/90 p-4 backdrop-blur-xl dark:bg-card/75">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"><ReceiptText className="h-6 w-6" /></div>
        <div><p className="text-lg font-black">TaxOMG</p><p className="text-xs text-muted-foreground">Coordinator Suite</p></div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <button key={item.label} onClick={() => { setActiveNav(item.label); setMobileSidebarOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground", activeNav === item.label && "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary hover:text-primary-foreground")}>
            <item.icon className="h-4 w-4" />{item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl bg-gradient-to-br from-primary to-cyan-500 p-4 text-primary-foreground">
        <p className="text-sm font-bold">June filing control</p>
        <p className="mt-1 text-xs opacity-85">5 entities monitored with automated exception checks.</p>
      </div>
    </aside>
  );

  return (
    <main className="dashboard-grid min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">{Sidebar}</div>
      {mobileSidebarOpen && <div className="fixed inset-0 z-50 grid grid-cols-[280px_1fr] bg-black/40 lg:hidden"><div>{Sidebar}</div><button aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)} /></div>}

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border bg-card/80 p-4 shadow-soft backdrop-blur-xl xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Button className="lg:hidden" variant="outline" size="icon" onClick={() => setMobileSidebarOpen(true)}><Menu className="h-4 w-4" /></Button>
            <div>
              <p className="text-sm font-semibold text-primary">Multi-company accounting environment</p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Tax Coordinator Dashboard</h1>
              <p className="text-sm text-muted-foreground">Operational cockpit for PPN, PPh, PBB, UMKM, and document readiness.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_210px_repeat(3,auto)] xl:items-center">
            <Select aria-label="Tax Period" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>{periods.map((period) => <option key={period}>{period}</option>)}</Select>
            <Select aria-label="Company" value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value as Company)}>{companies.map((company) => <option key={company}>{company}</option>)}</Select>
            <Input ref={excelInputRef} className="hidden" type="file" accept=".xls,.xlsx,.csv" onChange={(event) => simulateUpload(event.target.files?.[0], "Excel")} />
            <Button variant="outline" onClick={() => excelInputRef.current?.click()}><Upload className="h-4 w-4" />Upload Excel</Button>
            <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
            <Button onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Export Excel</Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode"><Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" /></Button>
          </div>
        </header>

        {error && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><XCircle className="h-5 w-5" />{error}</div>}
        {loading && <div className="mb-6 flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm"><Loader2 className="h-5 w-5 animate-spin text-primary" />Processing uploaded file and refreshing dashboard controls...</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["PPN Output", totals.output, "Collected VAT across selected scope"],
            ["PPN Input", totals.input, "Creditable input VAT captured"],
            ["KB/LB", totals.kbLb, totals.kbLb >= 0 ? "Underpayment position" : "Overpayment position"],
            ["Non-creditable VAT", totals.nonCreditable, "Blocked or unmatched VAT invoices"],
            ["Active Tax Period", selectedPeriod, `${selectedCompany} view`],
          ].map(([title, value, description]) => (
            <Card key={String(title)} className="overflow-hidden">
              <CardHeader className="pb-2"><CardDescription>{title}</CardDescription></CardHeader>
              <CardContent>{loading ? <Skeleton className="h-9 w-32" /> : <p className="text-2xl font-black tracking-tight">{typeof value === "number" ? formatCurrency(value) : value}</p>}<p className="mt-2 text-xs text-muted-foreground">{description}</p></CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle>Tax Status Table</CardTitle><CardDescription>Due-date and filing status by tax obligation.</CardDescription></CardHeader>
            <CardContent>{filteredTaxRows.length ? <Table><TableHeader>{statusTable.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{statusTable.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table> : <EmptyState title="No status rows" description="Change filters or upload source data to populate tax obligations." />}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>VAT Composition</CardTitle><CardDescription>Output, input, KB/LB, and non-creditable VAT mix.</CardDescription></CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={4}>{chartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle>VAT Calculation Table</CardTitle><CardDescription>Entity-level VAT reconciliation with NTPN tracking.</CardDescription></CardHeader>
            <CardContent>{filteredVatRows.length ? <Table><TableHeader><TableRow>{["Company", "Tax Period", "Output VAT", "Input VAT", "KB/LB", "NTPN"].map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{filteredVatRows.map((row) => <TableRow key={row.id}><TableCell className="font-semibold">{row.company}</TableCell><TableCell>{row.taxPeriod}</TableCell><TableCell>{formatCurrency(row.outputVat)}</TableCell><TableCell>{formatCurrency(row.inputVat)}</TableCell><TableCell className={row.kbLb >= 0 ? "text-amber-600" : "text-emerald-600"}>{formatCurrency(row.kbLb)}</TableCell><TableCell><Badge variant={row.ntpn === "Pending" ? "warning" : "success"}>{row.ntpn}</Badge></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No VAT calculations" description="No VAT rows match the selected company and period." />}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Alert Center</CardTitle><CardDescription>Exceptions requiring coordinator follow-up.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {alertItems.map(({ icon: Icon, title, description, variant }) => (
                <div key={title} className="flex gap-3 rounded-2xl border p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><Icon className="h-5 w-5" /></div><div><Badge variant={variant}>{title}</Badge><p className="mt-2 text-sm text-muted-foreground">{description}</p></div></div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="mt-6">
          <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Tax Document Management</CardTitle><CardDescription>Upload XML, Excel, and PDF evidence; track validation status by company.</CardDescription></div><div className="hidden items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground md:flex"><Search className="h-4 w-4" />Smart document matching enabled</div></CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="grid gap-3">
              {["XML", "Excel", "PDF"].map((type) => <label key={type} className="cursor-pointer rounded-2xl border border-dashed p-4 transition hover:border-primary hover:bg-primary/5"><input className="sr-only" type="file" accept={type === "XML" ? ".xml" : type === "Excel" ? ".xls,.xlsx,.csv" : ".pdf"} onChange={(event) => simulateUpload(event.target.files?.[0], type)} /><div className="flex items-center gap-3"><Upload className="h-5 w-5 text-primary" /><div><p className="font-semibold">Upload {type}</p><p className="text-xs text-muted-foreground">Drag-ready control for {type} source documents.</p></div></div></label>)}
            </div>
            <Table><TableHeader><TableRow>{["Document", "Company", "Type", "Status", "Updated"].map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{filteredDocuments.map((document) => <TableRow key={document.id}><TableCell className="font-semibold">{document.name}</TableCell><TableCell>{document.company}</TableCell><TableCell>{document.type}</TableCell><TableCell><Badge variant={statusVariant(document.status)}>{document.status}</Badge></TableCell><TableCell>{formatDate(document.updatedAt)}</TableCell></TableRow>)}</TableBody></Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
