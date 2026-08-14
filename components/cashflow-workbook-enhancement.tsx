"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { AlertTriangle, BadgeDollarSign, Cloud, FileSpreadsheet, PiggyBank, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EMPTY_CASHFLOW, normalizeCashflow, safeAmount, type CashflowData, type CashflowEntry } from "@/lib/cashflow";

const PAGE_ID = "cashflow";
const COST_TYPES = ["Fix Cost", "Project Cost", "Asset"] as const;
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const normalized = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("id-ID");
const clean = (value: unknown) => String(value ?? "").trim();
const uniq = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id"));

function currentPage() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("page") || "";
}

function contentShell() {
  return document.querySelector<HTMLElement>("main > div.min-h-screen");
}

function nativeContentSection() {
  const shell = contentShell();
  if (!shell) return null;
  return Array.from(shell.children).find((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "SECTION" && !child.hasAttribute("data-cashflow-workbook-host")) ?? null;
}

function kindOf(value: unknown) {
  const text = normalized(value);
  if (text.includes("pindah") || text.includes("transfer antar") || text.includes("transfer internal")) return "Pindah Dana";
  if (text.includes("revenue") || text.includes("pendapatan") || text.includes("penerimaan")) return "Revenue";
  if (text.includes("project")) return "Project Cost";
  if (text.includes("asset") || text.includes("aset")) return "Asset";
  if (text.includes("fix") || text.includes("fixed")) return "Fix Cost";
  return clean(value);
}

function isRevenue(row: CashflowEntry) {
  return kindOf(row.type) === "Revenue";
}

function isTransfer(row: CashflowEntry) {
  return kindOf(row.type) === "Pindah Dana";
}

function isCashOut(row: CashflowEntry) {
  return !isRevenue(row) && !isTransfer(row);
}

function periodOf(value: string) {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (iso) return `${iso[2]}-${iso[1]}`;
  const display = text.match(/^(\d{2})[-/](\d{4})$/);
  return display ? `${display[1]}-${display[2]}` : text;
}

function weekOf(value: unknown) {
  const text = clean(value);
  if (!text) return "-";
  const match = text.match(/(\d{1,2})/);
  return match ? `Week ${match[1]}` : text;
}

function excelDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  if (!text) return "-";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function amount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = clean(value).replace(/rp/gi, "").replace(/\s/g, "");
  if (!text) return 0;
  const normalizedNumber = /^[+-]?\d{1,3}([.,]\d{3})+$/.test(text) ? text.replace(/[.,]/g, "") : text.replace(/,/g, "");
  const parsed = Number(normalizedNumber);
  return Number.isFinite(parsed) ? parsed : 0;
}

function workbookProjectionRows(workbook: XLSX.WorkBook) {
  const sheets = workbook.SheetNames.filter((name) => /^PROYEKSI\s+\d{2}-\d{4}$/i.test(name.trim()));
  return sheets.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: 2, defval: null, raw: true });
    return rows.flatMap((source) => {
      const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key.trim().toUpperCase(), value]));
      const brand = clean(row.BRAND);
      const department = clean(row.DEPARTEMEN);
      const description = clean(row.DESKRIPSI);
      const nominal = amount(row["NOMINAL (RP)"] ?? row.NOMINAL);
      const type = kindOf(row.JENIS);
      if (!brand && !department && !description && nominal === 0) return [];
      const entry: CashflowEntry = {
        id: `projection-${crypto.randomUUID()}`,
        brand: brand || "-",
        department: department || "-",
        paymentItem: clean(row["ITEM PEMBAYARAN"]),
        description,
        type,
        nominal,
        date: excelDate(row.TANGGAL),
        week: weekOf(row.WEEK),
        source: `Excel Workbook · ${sheetName}`,
        notes: "",
      };
      return [entry];
    });
  });
}

function workbookActualRows(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames.find((name) => name.trim().toUpperCase() === "REALISASI");
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  return rows.flatMap((source) => {
    const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key.trim().toUpperCase(), value]));
    const brand = clean(row.BRAND);
    const department = clean(row.DEPARTEMEN);
    const description = clean(row["KETERANGAN FINANCE"]);
    const type = kindOf(row["JENIS TRANSAKSI"]);
    const debit = amount(row.DEBIT);
    const credit = amount(row.KREDIT);
    const nominal = type === "Revenue" ? debit || credit : type === "Pindah Dana" ? Math.max(debit, credit) : credit || debit;
    if (!brand && !department && !description && nominal === 0) return [];
    const entry: CashflowEntry = {
      id: `actual-${crypto.randomUUID()}`,
      brand: brand || "-",
      department: department || "-",
      paymentItem: description,
      description,
      type,
      nominal,
      date: excelDate(row.DATE),
      week: weekOf(row.WEEK),
      source: `Excel Workbook · ${sheetName}`,
      notes: clean(row["KETERANGAN BANK"]),
    };
    return [entry];
  });
}

function cashflowStatus(projection: number, actual: number) {
  if (projection === 0 && actual === 0) return "BELUM ADA DATA";
  if (actual === 0) return "BELUM REALISASI";
  if (projection === 0) return "TIDAK DIPROYEKSI";
  if (actual > projection) return "OVER CASHFLOW";
  return "ON CASHFLOW";
}

function statusClass(status: string) {
  if (status === "OVER CASHFLOW") return "bg-red-100 text-red-700";
  if (status === "ON CASHFLOW") return "bg-emerald-100 text-emerald-700";
  if (status === "TIDAK DIPROYEKSI") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function rowMatches(row: CashflowEntry, filters: Filters) {
  const contains = (source: string, filter: string) => !normalized(filter) || normalized(source).includes(normalized(filter));
  return contains(periodOf(row.date), filters.period)
    && contains(row.brand, filters.brand)
    && contains(row.week, filters.week)
    && contains(row.department, filters.department)
    && contains(kindOf(row.type), filters.type);
}

type Filters = { period: string; brand: string; week: string; department: string; type: string };
type BreakdownRow = { name: string; projection: number; actual: number; difference: number; realization: number; status: string };
type WeeklyRow = BreakdownRow & { cashIn: number; net: number };

function buildBreakdown(projection: CashflowEntry[], actual: CashflowEntry[], key: "type" | "department") {
  const names = uniq([...projection.map((row) => key === "type" ? kindOf(row.type) : row.department), ...actual.map((row) => key === "type" ? kindOf(row.type) : row.department)]);
  return names.map((name): BreakdownRow => {
    const projectionValue = projection.filter((row) => normalized(key === "type" ? kindOf(row.type) : row.department) === normalized(name) && isCashOut(row)).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
    const actualValue = actual.filter((row) => normalized(key === "type" ? kindOf(row.type) : row.department) === normalized(name) && isCashOut(row)).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
    return {
      name,
      projection: projectionValue,
      actual: actualValue,
      difference: projectionValue - actualValue,
      realization: projectionValue ? actualValue / projectionValue * 100 : actualValue ? -1 : 0,
      status: cashflowStatus(projectionValue, actualValue),
    };
  }).filter((row) => row.projection !== 0 || row.actual !== 0);
}

function buildWeeks(projection: CashflowEntry[], actual: CashflowEntry[]) {
  const names = uniq([...projection.map((row) => weekOf(row.week)), ...actual.map((row) => weekOf(row.week))]).filter((week) => week !== "-").sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));
  return names.map((name): WeeklyRow => {
    const projectedRows = projection.filter((row) => weekOf(row.week) === name);
    const actualRows = actual.filter((row) => weekOf(row.week) === name);
    const projectionValue = projectedRows.filter(isCashOut).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
    const actualValue = actualRows.filter(isCashOut).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
    const cashIn = actualRows.filter(isRevenue).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
    return {
      name,
      projection: projectionValue,
      actual: actualValue,
      difference: projectionValue - actualValue,
      realization: projectionValue ? actualValue / projectionValue * 100 : actualValue ? -1 : 0,
      status: cashflowStatus(projectionValue, actualValue),
      cashIn,
      net: cashIn - actualValue,
    };
  });
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return <Select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-40 flex-1 rounded-xl bg-white">
    <option value="">{placeholder}</option>
    {options.map((option) => <option key={option} value={option}>{option}</option>)}
  </Select>;
}

function EmptyRow({ span, text = "Belum ada data sesuai filter." }: { span: number; text?: string }) {
  return <TableRow><TableCell colSpan={span} className="h-24 text-center font-semibold text-slate-500">{text}</TableCell></TableRow>;
}

function BreakdownTable({ title, heading, rows }: { title: string; heading: string; rows: BreakdownRow[] }) {
  return <Card className="rounded-3xl">
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      <Table><TableHeader><TableRow>{[heading, "Proyeksi", "Realisasi", "Sisa / Over", "% Realisasi", "Status"].map((head) => <TableHead key={head}>{head}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.length ? rows.map((row) => <TableRow key={row.name}>
          <TableCell className="font-bold">{row.name}</TableCell><TableCell>{rupiah(row.projection)}</TableCell><TableCell>{rupiah(row.actual)}</TableCell><TableCell className={row.difference < 0 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>{rupiah(row.difference)}</TableCell><TableCell>{row.realization < 0 ? "-" : `${row.realization.toFixed(1)}%`}</TableCell><TableCell><Badge className={statusClass(row.status)}>{row.status}</Badge></TableCell>
        </TableRow>) : <EmptyRow span={6} />}</TableBody>
      </Table>
    </CardContent>
  </Card>;
}

function CashflowWorkbookDashboard() {
  const [data, setData] = useState<CashflowData>(EMPTY_CASHFLOW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>({ period: "", brand: "", week: "", department: "", type: "" });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/cashflow-data", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setData(normalizeCashflow(payload.cashflowData)))
      .catch(() => setError("Data Cashflow tidak dapat dimuat dari cloud."))
      .finally(() => setLoading(false));
  }, []);

  const allRows = useMemo(() => [...data.projection, ...data.actual], [data]);
  const options = useMemo(() => ({
    period: uniq(allRows.map((row) => periodOf(row.date))),
    brand: uniq(allRows.map((row) => row.brand)),
    week: uniq(allRows.map((row) => weekOf(row.week))).filter((value) => value !== "-"),
    department: uniq(allRows.map((row) => row.department)),
    type: uniq(allRows.map((row) => kindOf(row.type))).filter((type) => type !== "Pindah Dana"),
  }), [allRows]);

  const projection = useMemo(() => data.projection.filter((row) => rowMatches(row, filters)), [data.projection, filters]);
  const actual = useMemo(() => data.actual.filter((row) => rowMatches(row, filters)), [data.actual, filters]);
  const projectionCashOut = projection.filter(isCashOut);
  const actualCashOut = actual.filter(isCashOut);
  const totalProjection = projectionCashOut.reduce((sum, row) => sum + safeAmount(row.nominal), 0);
  const totalActual = actualCashOut.reduce((sum, row) => sum + safeAmount(row.nominal), 0);
  const remaining = totalProjection - totalActual;
  const realization = totalProjection ? totalActual / totalProjection * 100 : totalActual ? -1 : 0;
  const overallStatus = cashflowStatus(totalProjection, totalActual);
  const cashIn = actual.filter(isRevenue).reduce((sum, row) => sum + safeAmount(row.nominal), 0);
  const cashOut = totalActual;
  const netCashflow = cashIn - cashOut;
  const typeRows = buildBreakdown(projection, actual, "type").filter((row) => COST_TYPES.some((type) => normalized(type) === normalized(row.name)));
  const departmentRows = buildBreakdown(projection, actual, "department");
  const weeklyRows = buildWeeks(projection, actual);
  const chartRows = typeRows.map((row) => ({ name: row.name, Proyeksi: row.projection, Realisasi: row.actual }));
  const overDepartments = departmentRows.filter((row) => row.status === "OVER CASHFLOW" || row.status === "TIDAK DIPROYEKSI");

  async function saveToCloud() {
    const password = window.prompt("Masukkan password edit");
    if (!password) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const verify = await fetch("/api/verify-edit-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!verify.ok) throw new Error("Password salah. Aksi dibatalkan.");
      const response = await fetch("/api/cashflow-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ cashflowData: data }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Save to Cloud gagal.");
      setData((current) => ({ ...current, lastUpdated: payload.updatedAt }));
      setNotice("Cashflow berhasil disimpan ke cloud.");
    } catch (err) { setError(err instanceof Error ? err.message : "Save to Cloud gagal."); } finally { setSaving(false); }
  }

  async function importWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setError("File harus berformat .xlsx"); return; }
    if (!confirm("Import workbook akan mengganti data Proyeksi dan Realisasi Cashflow yang sedang aktif. Lanjutkan?")) return;
    setError(""); setNotice("Membaca workbook Cashflow...");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const projectionRows = workbookProjectionRows(workbook);
      const actualRows = workbookActualRows(workbook);
      if (!projectionRows.length) throw new Error("Sheet PROYEKSI mm-yyyy tidak ditemukan atau tidak berisi data.");
      if (!actualRows.length) throw new Error("Sheet REALISASI tidak ditemukan atau tidak berisi data.");
      setData((current) => ({ ...current, projection: projectionRows, actual: actualRows }));
      setFilters({ period: "", brand: "", week: "", department: "", type: "" });
      setNotice(`Workbook berhasil dibaca: ${projectionRows.length} baris Proyeksi dan ${actualRows.length} baris Realisasi. Klik Save to Cloud untuk menyimpan.`);
    } catch (err) { setNotice(""); setError(err instanceof Error ? err.message : "Workbook tidak dapat diproses."); }
  }

  if (loading) return <section className="space-y-6 p-4 sm:p-6 xl:p-8"><Card className="rounded-3xl"><CardContent className="p-8 text-center font-semibold text-slate-500">Memuat data Cashflow...</CardContent></Card></section>;

  const kpis = [
    { label: "Total Proyeksi", value: rupiah(totalProjection), Icon: Target, tone: "border-blue-500 bg-blue-50/70", iconTone: "bg-blue-100 text-blue-600" },
    { label: "Total Realisasi", value: rupiah(totalActual), Icon: BadgeDollarSign, tone: "border-emerald-500 bg-emerald-50/70", iconTone: "bg-emerald-100 text-emerald-600" },
    { label: "Sisa Cashflow", value: rupiah(remaining), Icon: PiggyBank, tone: remaining < 0 ? "border-red-500 bg-red-50/70" : "border-amber-500 bg-amber-50/70", iconTone: remaining < 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600" },
    { label: "% Realisasi", value: realization < 0 ? "-" : `${realization.toFixed(1)}%`, Icon: TrendingUp, tone: "border-violet-500 bg-violet-50/70", iconTone: "bg-violet-100 text-violet-600" },
  ];

  return <section className="space-y-6 p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Cashflow</h1><p className="mt-2 text-base font-medium text-slate-600">Monitoring cash in, cash out, proyeksi, realisasi, dan rolling cashflow mengikuti struktur workbook.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={fileInput} type="file" accept=".xlsx" onChange={importWorkbook} className="hidden"/><Button onClick={() => fileInput.current?.click()} variant="outline" className="rounded-xl"><FileSpreadsheet className="h-4 w-4"/> Upload Workbook Excel</Button><Button onClick={saveToCloud} disabled={saving} variant="outline" className="rounded-xl"><Cloud className="h-4 w-4"/> {saving ? "Menyimpan..." : "Save to Cloud"}</Button></div>
    </div>

    {notice && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{notice}</div>}
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <Card className="rounded-3xl"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <FilterSelect value={filters.period} onChange={(value) => setFilters((current) => ({ ...current, period: value }))} options={options.period} placeholder="Semua Periode" />
      <FilterSelect value={filters.brand} onChange={(value) => setFilters((current) => ({ ...current, brand: value }))} options={options.brand} placeholder="Semua Brand" />
      <FilterSelect value={filters.week} onChange={(value) => setFilters((current) => ({ ...current, week: value }))} options={options.week} placeholder="Semua Week" />
      <FilterSelect value={filters.department} onChange={(value) => setFilters((current) => ({ ...current, department: value }))} options={options.department} placeholder="Semua Departemen" />
      <FilterSelect value={filters.type} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} options={options.type} placeholder="Semua Jenis" />
    </CardContent></Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map(({ label, value, Icon, tone, iconTone }) => <Card key={label} className={`rounded-3xl border-t-4 ${tone}`}><CardContent className="p-5"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${iconTone}`}><Icon className="h-5 w-5"/></div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-xl font-black text-slate-950">{value}</p></CardContent></Card>)}
      <Card className={`rounded-3xl border-t-4 ${overallStatus === "OVER CASHFLOW" ? "border-red-500 bg-red-50/70" : overallStatus === "ON CASHFLOW" ? "border-emerald-500 bg-emerald-50/70" : "border-slate-400 bg-slate-50"}`}><CardContent className="p-5"><div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-white"><AlertTriangle className="h-5 w-5 text-slate-600"/></div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Status Cashflow</p><div className="mt-3"><Badge className={statusClass(overallStatus)}>{overallStatus}</Badge></div></CardContent></Card>
    </div>

    <Card className="rounded-3xl"><CardHeader><CardTitle>Ringkasan Arus Kas</CardTitle><CardDescription>Revenue dihitung sebagai Cash In. Fix Cost, Project Cost, dan Asset dihitung sebagai Cash Out. Pindah Dana tidak masuk perhitungan Cash Out.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Cash In (Revenue)</p><p className="mt-2 text-2xl font-black text-slate-950">{rupiah(cashIn)}</p></div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-red-700">Cash Out (Pengeluaran)</p><p className="mt-2 text-2xl font-black text-slate-950">{rupiah(cashOut)}</p></div>
      <div className={`rounded-2xl border p-5 ${netCashflow < 0 ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}><p className="text-xs font-black uppercase tracking-wider text-slate-600">Net Cash Flow</p><p className={`mt-2 text-2xl font-black ${netCashflow < 0 ? "text-red-700" : "text-blue-700"}`}>{rupiah(netCashflow)}</p></div>
    </CardContent></Card>

    <Card className="rounded-3xl"><CardHeader><CardTitle>Grafik Proyeksi vs Realisasi</CardTitle><CardDescription>Perbandingan Cash Out berdasarkan jenis biaya sesuai logika workbook.</CardDescription></CardHeader><CardContent>{chartRows.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} barCategoryGap="30%"><CartesianGrid strokeDasharray="4 6" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))}/><Tooltip formatter={(value) => rupiah(Number(value))}/><Legend/><Bar dataKey="Proyeksi" fill="#2563EB" radius={[8,8,0,0]}/><Bar dataKey="Realisasi" fill="#10B981" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div> : <div className="grid h-52 place-items-center rounded-2xl border border-dashed text-sm font-semibold text-slate-500">Belum ada data untuk grafik.</div>}</CardContent></Card>

    <Card className="rounded-3xl"><CardHeader><CardTitle>Rolling Cashflow per Week</CardTitle><CardDescription>Ringkasan mingguan seperti sheet Rolling Cashflow 2026.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Week","Proyeksi Cash Out","Realisasi Cash Out","Sisa / Over","% Realisasi","Status","Cash In","Net Cash Flow"].map((head) => <TableHead key={head}>{head}</TableHead>)}</TableRow></TableHeader><TableBody>{weeklyRows.length ? weeklyRows.map((row) => <TableRow key={row.name}><TableCell className="font-bold">{row.name}</TableCell><TableCell>{rupiah(row.projection)}</TableCell><TableCell>{rupiah(row.actual)}</TableCell><TableCell className={row.difference < 0 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>{rupiah(row.difference)}</TableCell><TableCell>{row.realization < 0 ? "-" : `${row.realization.toFixed(1)}%`}</TableCell><TableCell><Badge className={statusClass(row.status)}>{row.status}</Badge></TableCell><TableCell>{rupiah(row.cashIn)}</TableCell><TableCell className={row.net < 0 ? "font-bold text-red-600" : "font-bold text-blue-700"}>{rupiah(row.net)}</TableCell></TableRow>) : <EmptyRow span={8}/>}</TableBody></Table></CardContent></Card>

    <BreakdownTable title="Detail per Jenis Biaya" heading="Jenis Biaya" rows={typeRows}/>
    <BreakdownTable title="Detail per Departemen" heading="Departemen" rows={departmentRows}/>

    <Card className="rounded-3xl"><CardHeader><CardTitle>Analisis Penyebab Over</CardTitle><CardDescription>Departemen yang realisasinya melebihi proyeksi atau tidak memiliki proyeksi.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Departemen","Proyeksi","Realisasi","Over","Status","Top Penyebab Over"].map((head) => <TableHead key={head}>{head}</TableHead>)}</TableRow></TableHeader><TableBody>{overDepartments.length ? overDepartments.map((row) => {
      const top = actual.filter((entry) => normalized(entry.department) === normalized(row.name) && isCashOut(entry)).sort((a, b) => safeAmount(b.nominal) - safeAmount(a.nominal))[0];
      return <TableRow key={row.name}><TableCell className="font-bold">{row.name}</TableCell><TableCell>{rupiah(row.projection)}</TableCell><TableCell>{rupiah(row.actual)}</TableCell><TableCell className="font-bold text-red-600">{rupiah(Math.max(row.actual - row.projection, 0))}</TableCell><TableCell><Badge className={statusClass(row.status)}>{row.status}</Badge></TableCell><TableCell className="max-w-md whitespace-normal">{top?.description || "-"}</TableCell></TableRow>;
    }) : <EmptyRow span={6} text="Tidak ada departemen yang over sesuai filter."/>}</TableBody></Table></CardContent></Card>
  </section>;
}

export function CashflowWorkbookEnhancement() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      const shell = contentShell();
      const section = nativeContentSection();
      const isActive = Boolean(shell && section && currentPage() === PAGE_ID);
      setActive(isActive);

      if (!shell || !section) {
        setHost(null);
        return;
      }

      let portalHost = shell.querySelector<HTMLElement>(":scope > [data-cashflow-workbook-host]");
      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.cashflowWorkbookHost = "true";
        shell.appendChild(portalHost);
      }
      setHost((current) => current === portalHost ? current : portalHost);
      section.style.display = isActive ? "none" : "";
      portalHost.style.display = isActive ? "block" : "none";
    };

    sync();
    timer = window.setInterval(sync, 300);
    window.addEventListener("popstate", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("focus", sync);
      const section = nativeContentSection();
      if (section) section.style.display = "";
    };
  }, []);

  if (!host || !active) return null;
  return createPortal(<CashflowWorkbookDashboard/>, host);
}
