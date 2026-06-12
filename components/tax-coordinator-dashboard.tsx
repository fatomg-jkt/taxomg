"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { AlertTriangle, BarChart3, Building2, Database, Download, Edit3, FileArchive, FileSpreadsheet, FileText, Menu, Moon, Plus, ReceiptText, Save, Search, ShieldAlert, Sun, Trash2, Upload, X } from "lucide-react";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  companies,
  companyNames,
  documentCategories,
  documentStatuses,
  filingStatuses,
  formatCurrency,
  formatDate,
  paymentStatuses,
  periods,
  seedTaxData,
  type Company,
  type TaxDatabase,
} from "@/lib/tax-data";

type ModuleKey = keyof TaxDatabase;
type RecordMap = TaxDatabase[ModuleKey][number];
type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary";
type FieldType = "text" | "number" | "date" | "textarea" | "select";

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  currency?: boolean;
  min?: number;
};

type ModuleConfig = {
  key: ModuleKey;
  title: string;
  description: string;
  addLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  fields: FieldConfig[];
  columns?: FieldConfig[];
  amountKey: string;
  periodKey: string;
  statusKeys: string[];
};

const storageKey = "taxomg-manual-data-v1";
const chartColors = ["#3b82f6", "#14b8a6", "#f59e0b", "#ef4444", "#a855f7"];
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "PPN", href: "/ppn", icon: ReceiptText },
  { label: "PPh Pasal 21", href: "/pph-pasal-21", icon: FileText },
  { label: "PPh Unifikasi", href: "/pph-unifikasi", icon: FileArchive },
  { label: "PBB", href: "/pbb", icon: Building2 },
  { label: "UMKM", href: "/umkm", icon: Database },
  { label: "Tax Documents", href: "/tax-documents", icon: FileSpreadsheet },
];

const commonStatuses = [...filingStatuses, "Paid"];

const moduleConfigs = {
  ppn: {
    key: "ppn",
    title: "PPN Manual Entry",
    description: "Kelola PPN keluaran, PPN masukan, KB/LB, NTPN, dan status lapor/bayar tanpa upload wajib.",
    addLabel: "Add PPN record",
    emptyTitle: "Belum ada data PPN",
    emptyDescription: "Tambahkan rekonsiliasi PPN manual pertama untuk mulai memantau kewajiban VAT.",
    amountKey: "kbLb",
    periodKey: "taxPeriod",
    statusKeys: ["filingStatus", "paymentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true, options: periods },
      { key: "ppnOutput", label: "PPN Output", type: "number", required: true, currency: true, min: 0 },
      { key: "ppnInput", label: "PPN Input", type: "number", required: true, currency: true, min: 0 },
      { key: "kbLb", label: "KB/LB", type: "number", required: true, currency: true },
      { key: "nonCreditableVat", label: "Non-creditable VAT", type: "number", required: true, currency: true, min: 0 },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      { key: "filingStatus", label: "Filing Status", type: "select", required: true, options: filingStatuses },
      { key: "paymentStatus", label: "Payment Status", type: "select", required: true, options: paymentStatuses },
      { key: "ntpn", label: "NTPN", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  pph21: {
    key: "pph21",
    title: "PPh Pasal 21 Manual Entry",
    description: "Input pajak payroll, jumlah karyawan, penghasilan kena pajak, dan pembayaran PPh 21.",
    addLabel: "Add PPh 21 record",
    emptyTitle: "Belum ada data PPh 21",
    emptyDescription: "Tambahkan data payroll tax manual untuk ringkasan karyawan dan outstanding tax.",
    amountKey: "pph21Payable",
    periodKey: "taxPeriod",
    statusKeys: ["filingStatus", "paymentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true, options: periods },
      { key: "employeeCount", label: "Employee Count", type: "number", required: true, min: 0 },
      { key: "grossPayroll", label: "Gross Payroll", type: "number", required: true, currency: true, min: 0 },
      { key: "taxableIncome", label: "Taxable Income", type: "number", required: true, currency: true, min: 0 },
      { key: "pph21Payable", label: "PPh 21 Payable", type: "number", required: true, currency: true, min: 0 },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      { key: "filingStatus", label: "Filing Status", type: "select", required: true, options: filingStatuses },
      { key: "paymentStatus", label: "Payment Status", type: "select", required: true, options: paymentStatuses },
      { key: "ntpn", label: "NTPN", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  pphUnifikasi: {
    key: "pphUnifikasi",
    title: "PPh Unifikasi Manual Entry",
    description: "Kelola withholding tax berdasarkan objek pajak, lawan transaksi, DPP, tarif, dan bukti potong.",
    addLabel: "Add Unifikasi record",
    emptyTitle: "Belum ada data PPh Unifikasi",
    emptyDescription: "Tambahkan objek withholding tax dan bukti potong secara manual.",
    amountKey: "pphAmount",
    periodKey: "taxPeriod",
    statusKeys: ["filingStatus", "paymentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true, options: periods },
      { key: "taxObject", label: "Tax Object", type: "text", required: true },
      { key: "counterparty", label: "Counterparty", type: "text", required: true },
      { key: "dpp", label: "DPP", type: "number", required: true, currency: true, min: 0 },
      { key: "taxRate", label: "Tax Rate (%)", type: "number", required: true, min: 0 },
      { key: "pphAmount", label: "PPh Amount", type: "number", required: true, currency: true, min: 0 },
      { key: "bupotNumber", label: "Bupot Number", type: "text" },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      { key: "filingStatus", label: "Filing Status", type: "select", required: true, options: filingStatuses },
      { key: "paymentStatus", label: "Payment Status", type: "select", required: true, options: paymentStatuses },
      { key: "ntpn", label: "NTPN", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  pbb: {
    key: "pbb",
    title: "PBB Manual Entry",
    description: "Pantau pajak bumi dan bangunan berdasarkan NOP, NJOP, tahun pajak, dan status bayar.",
    addLabel: "Add PBB record",
    emptyTitle: "Belum ada data PBB",
    emptyDescription: "Tambahkan aset properti untuk memantau PBB payable.",
    amountKey: "pbbPayable",
    periodKey: "taxYear",
    statusKeys: ["paymentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "propertyName", label: "Property Name", type: "text", required: true },
      { key: "propertyAddress", label: "Property Address", type: "textarea", required: true },
      { key: "nop", label: "NOP", type: "text", required: true },
      { key: "taxYear", label: "Tax Year", type: "text", required: true },
      { key: "njop", label: "NJOP", type: "number", required: true, currency: true, min: 0 },
      { key: "pbbPayable", label: "PBB Payable", type: "number", required: true, currency: true, min: 0 },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      { key: "paymentStatus", label: "Payment Status", type: "select", required: true, options: paymentStatuses },
      { key: "ntpn", label: "NTPN", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  umkm: {
    key: "umkm",
    title: "UMKM Final Tax Manual Entry",
    description: "Input omzet, tarif final, pajak final terutang, due date, dan NTPN UMKM.",
    addLabel: "Add UMKM record",
    emptyTitle: "Belum ada data UMKM",
    emptyDescription: "Tambahkan revenue dan final tax UMKM secara manual.",
    amountKey: "finalTaxPayable",
    periodKey: "taxPeriod",
    statusKeys: ["filingStatus", "paymentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true, options: periods },
      { key: "revenue", label: "Revenue", type: "number", required: true, currency: true, min: 0 },
      { key: "taxRate", label: "Tax Rate (%)", type: "number", required: true, min: 0 },
      { key: "finalTaxPayable", label: "Final Tax Payable", type: "number", required: true, currency: true, min: 0 },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      { key: "filingStatus", label: "Filing Status", type: "select", required: true, options: filingStatuses },
      { key: "paymentStatus", label: "Payment Status", type: "select", required: true, options: paymentStatuses },
      { key: "ntpn", label: "NTPN", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  taxDocuments: {
    key: "taxDocuments",
    title: "Tax Documents Manual Tracker",
    description: "Catat invoice, SPT, bukti bayar, bupot, NTPN, dan dokumen lain tanpa upload file wajib.",
    addLabel: "Add document record",
    emptyTitle: "Belum ada dokumen pajak",
    emptyDescription: "Tambahkan checklist dokumen manual untuk mengurangi missing documents.",
    amountKey: "referenceNumber",
    periodKey: "taxPeriod",
    statusKeys: ["documentStatus"],
    fields: [
      { key: "company", label: "Company", type: "select", required: true, options: companyNames },
      { key: "taxType", label: "Tax Type", type: "select", required: true, options: ["PPN", "PPh Pasal 21", "PPh Unifikasi", "PBB", "UMKM"] },
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true, options: periods },
      { key: "documentName", label: "Document Name", type: "text", required: true },
      { key: "documentCategory", label: "Document Category", type: "select", required: true, options: documentCategories },
      { key: "documentStatus", label: "Document Status", type: "select", required: true, options: documentStatuses },
      { key: "referenceNumber", label: "Reference Number", type: "text", required: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
} satisfies Record<string, ModuleConfig>;

function cloneSeed(): TaxDatabase {
  return JSON.parse(JSON.stringify(seedTaxData)) as TaxDatabase;
}

function useTaxDatabase() {
  const [data, setData] = useState<TaxDatabase>(cloneSeed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setData(saved ? ({ ...cloneSeed(), ...JSON.parse(saved) } as TaxDatabase) : cloneSeed());
    } catch {
      setError("Local data could not be loaded. Seed data is shown instead.");
      setData(cloneSeed());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, loading]);

  function upsertRecord<K extends ModuleKey>(key: K, record: TaxDatabase[K][number]) {
    setData((current) => {
      const rows = current[key] as TaxDatabase[K];
      const nextRows = rows.some((row) => row.id === record.id) ? rows.map((row) => (row.id === record.id ? record : row)) : [record, ...rows];
      return { ...current, [key]: nextRows };
    });
  }

  function deleteRecord<K extends ModuleKey>(key: K, id: string) {
    setData((current) => ({ ...current, [key]: (current[key] as TaxDatabase[K]).filter((row) => row.id !== id) }));
  }

  return { data, setData, loading, error, upsertRecord, deleteRecord };
}

function statusVariant(status: unknown): BadgeVariant {
  if (["Filed", "Paid", "Verified", "Archived", "Received"].includes(String(status))) return "success";
  if (["Due Soon", "In Review", "Requested"].includes(String(status))) return "warning";
  if (["Overdue", "Missing Docs", "Missing"].includes(String(status))) return "destructive";
  return "secondary";
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
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
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
      <ShieldAlert className="mb-3 h-9 w-9 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{title}</CardDescription></CardHeader>
      <CardContent><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></CardContent>
    </Card>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <main className="dashboard-grid min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-72 border-r bg-card/95 p-5 backdrop-blur transition-transform lg:translate-x-0", mobileSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ReceiptText /></div><div><p className="text-lg font-bold">TaxOMG</p><p className="text-xs text-muted-foreground">Tax Coordinator</p></div></div>
        <nav className="mt-8 space-y-2">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (pathname === "/" && href === "/dashboard");
            return <Link key={href} href={href} onClick={() => setMobileSidebarOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}><Icon className="h-4 w-4" />{label}</Link>;
          })}
        </nav>
      </aside>
      <section className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div><p className="text-sm text-muted-foreground">Manual Tax Operations</p><h1 className="text-xl font-bold">TaxOMG / Tax Coordinator Dashboard</h1></div>
          <Button variant="secondary" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </section>
    </main>
  );
}

function fieldValue(row: Record<string, unknown>, field: FieldConfig) {
  const value = row[field.key];
  if (field.currency && typeof value === "number") return formatCurrency(value);
  if (field.key.toLowerCase().includes("date") && typeof value === "string") return formatDate(value);
  if (field.key.toLowerCase().includes("status")) return <Badge variant={statusVariant(value)}>{String(value)}</Badge>;
  return String(value ?? "-");
}

function defaultValue<T extends RecordMap>(fields: FieldConfig[]): Partial<T> {
  const value: Record<string, unknown> = { id: `manual-${crypto.randomUUID()}`, updatedAt: new Date().toISOString(), notes: "" };
  for (const field of fields) {
    if (field.type === "number") value[field.key] = 0;
    else if (field.options?.length) value[field.key] = field.options[0];
    else if (field.type === "date") value[field.key] = new Date().toISOString().slice(0, 10);
    else value[field.key] = "";
  }
  return value as Partial<T>;
}

function validateForm<T extends RecordMap>(fields: FieldConfig[], draft: Partial<T>) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = draft[field.key as keyof T];
    if (field.required && (value === "" || value === undefined || value === null)) errors[field.key] = `${field.label} wajib diisi.`;
    if (field.type === "number") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) errors[field.key] = `${field.label} harus numerik.`;
      if (field.min !== undefined && numeric < field.min) errors[field.key] = `${field.label} tidak boleh negatif.`;
    }
    if (field.type === "date" && value && Number.isNaN(Date.parse(String(value)))) errors[field.key] = `${field.label} harus tanggal valid.`;
  }
  return errors;
}

function RecordForm<T extends RecordMap>({ config, draft, errors, setDraft, onCancel, onSave }: { config: ModuleConfig; draft: Partial<T>; errors: Record<string, string>; setDraft: (draft: Partial<T>) => void; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{config.addLabel}</h2><p className="text-sm text-muted-foreground">Manual add/edit with validation and local persistence.</p></div><Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {config.fields.map((field) => {
            const value = draft[field.key as keyof T] ?? "";
            const common = { id: field.key, value: String(value), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft({ ...draft, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value }) };
            return (
              <label key={field.key} className={cn("space-y-1.5 text-sm font-medium", field.type === "textarea" && "md:col-span-2")} htmlFor={field.key}>
                <span>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</span>
                {field.type === "select" ? <Select {...common}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</Select> : field.type === "textarea" ? <textarea {...common} className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /> : <Input {...common} type={field.type} min={field.min} />}
                {field.currency ? <p className="text-xs text-muted-foreground">Preview: {formatCurrency(Number(value))}</p> : null}
                {errors[field.key] ? <p className="text-xs text-destructive">{errors[field.key]}</p> : null}
              </label>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={onSave}><Save className="h-4 w-4" />Save</Button></div>
      </div>
    </div>
  );
}

function ManualCrudPage<T extends RecordMap>({ config, rows, upsertRecord, deleteRecord, loading, error, extraSummary }: { config: ModuleConfig; rows: T[]; upsertRecord: (record: T) => void; deleteRecord: (id: string) => void; loading: boolean; error: string | null; extraSummary?: React.ReactNode }) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState<Company>("All Companies");
  const [period, setPeriod] = useState("All Periods");
  const [status, setStatus] = useState("All Statuses");
  const [draft, setDraft] = useState<Partial<T> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => rows.filter((row) => {
    const flat = JSON.stringify(row).toLowerCase();
    const periodValue = String((row as Record<string, unknown>)[config.periodKey] ?? "");
    const statusMatch = config.statusKeys.some((key) => String((row as Record<string, unknown>)[key]) === status);
    return (!search || flat.includes(search.toLowerCase())) && (company === "All Companies" || row.company === company) && (period === "All Periods" || periodValue === period) && (status === "All Statuses" || statusMatch);
  }), [rows, search, company, period, status, config.periodKey, config.statusKeys]);

  function openNew() { setErrors({}); setDraft(defaultValue(config.fields)); }
  function openEdit(row: T) { setErrors({}); setDraft({ ...row }); }
  function saveDraft() {
    if (!draft) return;
    const nextErrors = validateForm(config.fields, draft);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    upsertRecord({ ...draft, updatedAt: new Date().toISOString() } as T);
    setDraft(null);
  }
  function exportCsv() { downloadBlob(`${config.key}.csv`, toCsv(filteredRows as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8"); }
  function exportExcel() { const worksheet = XLSX.utils.json_to_sheet(filteredRows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, config.title.slice(0, 30)); XLSX.writeFile(workbook, `${config.key}.xlsx`); }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><Badge>Manual CRUD</Badge><h2 className="mt-3 text-3xl font-bold tracking-tight">{config.title}</h2><p className="mt-2 max-w-3xl text-muted-foreground">{config.description}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary"><Upload className="h-4 w-4" />Upload Excel</Button><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button><Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4" />Export Excel</Button><Button onClick={openNew}><Plus className="h-4 w-4" />{config.addLabel}</Button></div></div>
        {error ? <Card className="border-destructive"><CardContent className="pt-5 text-sm text-destructive">{error}</CardContent></Card> : null}
        {extraSummary}
        <Card>
          <CardHeader><CardTitle>Search & Filters</CardTitle><CardDescription>Filter by company, tax period/tax year, or status.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search records..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={company} onChange={(event) => setCompany(event.target.value as Company)}>{companies.map((item) => <option key={item}>{item}</option>)}</Select><Select value={period} onChange={(event) => setPeriod(event.target.value)}><option>All Periods</option>{[...periods, "2026"].map((item) => <option key={item}>{item}</option>)}</Select><Select value={status} onChange={(event) => setStatus(event.target.value)}><option>All Statuses</option>{commonStatuses.concat(documentStatuses).filter((item, index, array) => array.indexOf(item) === index).map((item) => <option key={item}>{item}</option>)}</Select></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Editable Records</CardTitle><CardDescription>{filteredRows.length} records shown. Last updated is saved in localStorage.</CardDescription></CardHeader>
          <CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading manual tax data...</p> : filteredRows.length ? <Table><TableHeader><TableRow>{(config.columns ?? config.fields).map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}<TableHead>Last Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredRows.map((row) => <TableRow key={row.id}>{(config.columns ?? config.fields).map((field) => <TableCell key={field.key}>{fieldValue(row as Record<string, unknown>, field as FieldConfig)}</TableCell>)}<TableCell>{formatDate(row.updatedAt)}</TableCell><TableCell><div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => openEdit(row)}><Edit3 className="h-3.5 w-3.5" />Edit</Button>{config.key === "ppn" ? <><Button variant="outline" size="sm" onClick={() => upsertRecord({ ...row, filingStatus: "Filed", updatedAt: new Date().toISOString() } as T)}>Mark as Filed</Button><Button variant="outline" size="sm" onClick={() => upsertRecord({ ...row, paymentStatus: "Paid", updatedAt: new Date().toISOString() } as T)}>Mark as Paid</Button></> : null}<Button variant="destructive" size="sm" onClick={() => window.confirm("Delete this record? This action cannot be undone.") && deleteRecord(row.id)}><Trash2 className="h-3.5 w-3.5" />Delete</Button></div></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title={config.emptyTitle} description={config.emptyDescription} />}</CardContent>
        </Card>
        {draft ? <RecordForm config={config} draft={draft} errors={errors} setDraft={setDraft} onCancel={() => setDraft(null)} onSave={saveDraft} /> : null}
      </div>
    </AppShell>
  );
}

function allTaxRows(data: TaxDatabase) {
  return [
    ...data.ppn.map((row) => ({ type: "PPN", company: row.company, period: row.taxPeriod, amount: row.kbLb, dueDate: row.dueDate, status: row.paymentStatus, updatedAt: row.updatedAt })),
    ...data.pph21.map((row) => ({ type: "PPh Pasal 21", company: row.company, period: row.taxPeriod, amount: row.pph21Payable, dueDate: row.dueDate, status: row.paymentStatus, updatedAt: row.updatedAt })),
    ...data.pphUnifikasi.map((row) => ({ type: "PPh Unifikasi", company: row.company, period: row.taxPeriod, amount: row.pphAmount, dueDate: row.dueDate, status: row.paymentStatus, updatedAt: row.updatedAt })),
    ...data.pbb.map((row) => ({ type: "PBB", company: row.company, period: row.taxYear, amount: row.pbbPayable, dueDate: row.dueDate, status: row.paymentStatus, updatedAt: row.updatedAt })),
    ...data.umkm.map((row) => ({ type: "UMKM", company: row.company, period: row.taxPeriod, amount: row.finalTaxPayable, dueDate: row.dueDate, status: row.paymentStatus, updatedAt: row.updatedAt })),
  ];
}

function DashboardPage({ data, loading, error }: { data: TaxDatabase; loading: boolean; error: string | null }) {
  const taxRows = allTaxRows(data);
  const totalsByType = [
    { name: "PPN", value: data.ppn.reduce((sum, row) => sum + row.kbLb, 0) },
    { name: "PPh 21", value: data.pph21.reduce((sum, row) => sum + row.pph21Payable, 0) },
    { name: "PPh Unifikasi", value: data.pphUnifikasi.reduce((sum, row) => sum + row.pphAmount, 0) },
    { name: "PBB", value: data.pbb.reduce((sum, row) => sum + row.pbbPayable, 0) },
    { name: "UMKM", value: data.umkm.reduce((sum, row) => sum + row.finalTaxPayable, 0) },
  ];
  const outstanding = taxRows.filter((row) => row.status !== "Paid").reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const dueSoon = taxRows.filter((row) => row.status === "Due Soon").length;
  const missingDocs = data.taxDocuments.filter((row) => row.documentStatus === "Missing").length + taxRows.filter((row) => row.status === "Missing Docs").length;
  const companyChart = companyNames.map((company) => ({ company: company.replace("PT ", ""), amount: taxRows.filter((row) => row.company === company).reduce((sum, row) => sum + Math.max(0, row.amount), 0) }));
  const recent = [...taxRows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);
  const alerts = taxRows.filter((row) => ["Due Soon", "Overdue", "Missing Docs"].includes(row.status)).slice(0, 6);
  const vatComposition = [{ name: "PPN Output", value: data.ppn.reduce((sum, row) => sum + row.ppnOutput, 0) }, { name: "PPN Input", value: data.ppn.reduce((sum, row) => sum + row.ppnInput, 0) }, { name: "KB/LB", value: Math.abs(totalsByType[0].value) }];

  return (
    <AppShell>
      <div className="space-y-6">
        <div><Badge>Live from editable localStorage data</Badge><h2 className="mt-3 text-3xl font-bold tracking-tight">Dashboard</h2><p className="mt-2 text-muted-foreground">Ringkasan otomatis dari seluruh manual-entry tax modules.</p></div>
        {loading ? <Card><CardContent className="pt-5 text-sm text-muted-foreground">Loading dashboard data...</CardContent></Card> : null}
        {error ? <Card className="border-destructive"><CardContent className="pt-5 text-sm text-destructive">{error}</CardContent></Card> : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {totalsByType.map((item) => <SummaryCard key={item.name} title={`Total ${item.name}`} value={formatCurrency(item.value)} helper="From current manual records" />)}
          <SummaryCard title="Total outstanding tax" value={formatCurrency(outstanding)} helper="Payment status not marked Paid" />
          <SummaryCard title="Due soon count" value={String(dueSoon)} helper="Records needing near-term action" />
          <SummaryCard title="Missing documents count" value={String(missingDocs)} helper="Document and tax rows requiring evidence" />
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]"><Card><CardHeader><CardTitle>Tax Status Table</CardTitle><CardDescription>Status and due date by editable tax module.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow>{["Tax Type", "Company", "Period", "Due Date", "Status", "Amount"].map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{taxRows.map((row, index) => <TableRow key={`${row.type}-${row.company}-${index}`}><TableCell className="font-semibold">{row.type}</TableCell><TableCell>{row.company}</TableCell><TableCell>{row.period}</TableCell><TableCell>{formatDate(row.dueDate)}</TableCell><TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell><TableCell>{formatCurrency(row.amount)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle>VAT Composition</CardTitle><CardDescription>PPN output, input, and absolute KB/LB.</CardDescription></CardHeader><CardContent className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={vatComposition} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>{vatComposition.map((entry, index) => <Cell key={entry.name} fill={chartColors[index]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /></PieChart></ResponsiveContainer></CardContent></Card></section>
        <section className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Tax by Type</CardTitle></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={totalsByType}><XAxis dataKey="name" /><YAxis tickFormatter={(value) => `${Number(value) / 1_000_000}M`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Tax by Company</CardTitle></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={companyChart}><XAxis dataKey="company" /><YAxis tickFormatter={(value) => `${Number(value) / 1_000_000}M`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" fill="#14b8a6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card></section>
        <section className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Recent Updates</CardTitle></CardHeader><CardContent className="space-y-3">{recent.map((row, index) => <div key={`${row.type}-${index}`} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-semibold">{row.type} · {row.company}</p><p className="text-xs text-muted-foreground">Updated {formatDate(row.updatedAt)}</p></div><Badge variant={statusVariant(row.status)}>{row.status}</Badge></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Alert Center</CardTitle></CardHeader><CardContent className="space-y-3">{alerts.length ? alerts.map((row, index) => <div key={`${row.type}-alert-${index}`} className="flex gap-3 rounded-xl border p-3"><AlertTriangle className="mt-1 h-5 w-5 text-amber-500" /><div><Badge variant={statusVariant(row.status)}>{row.status}</Badge><p className="mt-2 text-sm">{row.type} for {row.company} is due {formatDate(row.dueDate)}.</p></div></div>) : <EmptyState title="No active alerts" description="No due soon, overdue, or missing document tax rows right now." />}</CardContent></Card></section>
      </div>
    </AppShell>
  );
}

export function TaxCoordinatorDashboard({ module }: { module?: ModuleKey | "dashboard" }) {
  const { data, loading, error, upsertRecord, deleteRecord } = useTaxDatabase();
  if (!module || module === "dashboard") return <DashboardPage data={data} loading={loading} error={error} />;
  const config = moduleConfigs[module] as ModuleConfig;
  const rows = data[module] as RecordMap[];
  const summary = module === "pph21" ? <section className="grid gap-4 md:grid-cols-4"><SummaryCard title="Total PPh 21 Payable" value={formatCurrency(data.pph21.reduce((sum, row) => sum + row.pph21Payable, 0))} helper="All payroll tax rows" /><SummaryCard title="Employees Covered" value={String(data.pph21.reduce((sum, row) => sum + row.employeeCount, 0))} helper="Across selected companies" /><SummaryCard title="Paid Amount" value={formatCurrency(data.pph21.filter((row) => row.paymentStatus === "Paid").reduce((sum, row) => sum + row.pph21Payable, 0))} helper="Marked as Paid" /><SummaryCard title="Outstanding Amount" value={formatCurrency(data.pph21.filter((row) => row.paymentStatus !== "Paid").reduce((sum, row) => sum + row.pph21Payable, 0))} helper="Payment status not Paid" /></section> : undefined;
  return <ManualCrudPage config={{ ...config, columns: config.fields.filter((field) => field.type !== "textarea").slice(0, 8) }} rows={rows} upsertRecord={(record) => upsertRecord(module, record)} deleteRecord={(id) => deleteRecord(module, id)} loading={loading} error={error} extraSummary={summary} />;
}
