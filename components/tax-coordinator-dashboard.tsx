"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, Filter, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STORAGE_KEY = "tax-monitoring-normalized-v1";
const ALL = "Semua";
const TAX_TYPES = ["PPh Pasal 21", "PPh Pasal 23", "PPh Final Pasal 4 ayat 2", "PPh UMKM", "PB 1", "PPN"] as const;
const PPH_TYPES = TAX_TYPES.slice(0, 4);
const COLORS = ["#1d4ed8", "#0f766e", "#7c3aed", "#0891b2", "#f97316", "#0f172a"];

type TaxType = (typeof TAX_TYPES)[number];
type Status = "Sudah ada NTPN/NTPD" | "Belum ada NTPN/NTPD" | "Kompensasi lebih bayar" | "Data kosong" | "Nilai pajak 0";
type Page = "summary" | "pph" | "ppn" | "pb1" | "quality";
type TaxTransaction = {
  id: string;
  company: string;
  period: string;
  year: string;
  taxType: TaxType;
  dpp: number;
  taxAmount: number;
  ntpnNtpd: string;
  status: Status;
  note: string;
  sourceSheet: string;
  sourceRow: number;
  outputVat?: number;
  inputVat?: number;
};

type Filters = { year: string; period: string; company: string; taxType: string; status: string };

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  const text = clean(value).replace(/\((.*)\)/, "-$1").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parts = text.split(".");
  const normalized = parts.length > 2 ? `${parts.slice(0, -1).join("")}.${parts.at(-1)}` : text;
  return Number(normalized) || 0;
}

function monthIndex(name: string) {
  const months = ["jan", "feb", "mar", "apr", "may", "mei", "jun", "jul", "aug", "agu", "sep", "oct", "okt", "nov", "dec", "des"];
  const idx = months.findIndex((m) => name.toLowerCase().startsWith(m));
  if (idx < 0) return 0;
  return idx > 4 ? idx - 1 : idx;
}

function normalizePeriod(value: unknown) {
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return new Date(d.y, d.m - 1, d.d).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "-");
  }
  const text = clean(value);
  if (!text) return "-";
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "-");
  const match = text.match(/(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*[\s/-]*(\d{2,4})/i);
  if (!match) return text;
  const year = match[2].length === 2 ? match[2] : match[2].slice(-2);
  return `${match[1].slice(0, 3)[0].toUpperCase()}${match[1].slice(1, 3).toLowerCase()}-${year}`;
}

function periodYear(period: string) {
  const match = period.match(/(\d{2,4})$/);
  if (!match) return "2026";
  return match[1].length === 2 ? `20${match[1]}` : match[1];
}

function periodSort(period: string) {
  const [m] = period.split("-");
  return Number(periodYear(period)) * 100 + monthIndex(m);
}

function taxTypeFromText(value: unknown, sheet = ""): TaxType | undefined {
  const text = `${value ?? ""} ${sheet}`.toLowerCase();
  if (/pb\s*1|resto|restaurant|restoran/.test(text)) return "PB 1";
  if (/umkm/.test(text)) return "PPh UMKM";
  if (/4\s*\(?2\)?|final/.test(text)) return "PPh Final Pasal 4 ayat 2";
  if (/23/.test(text)) return "PPh Pasal 23";
  if (/21/.test(text)) return "PPh Pasal 21";
  if (/ppn|vat|keluaran|masukan|kb|lb/.test(text)) return "PPN";
  return undefined;
}

function paymentStatus(taxAmount: number, dpp: number, ntpnNtpd: string, note: string): Status {
  const text = `${ntpnNtpd} ${note}`.toLowerCase();
  if (/kompensasi|lebih bayar|\blb\b/.test(text) || taxAmount < 0) return "Kompensasi lebih bayar";
  if (!taxAmount) return "Nilai pajak 0";
  if (!dpp && !ntpnNtpd && !note) return "Data kosong";
  return ntpnNtpd && ntpnNtpd !== "-" ? "Sudah ada NTPN/NTPD" : "Belum ada NTPN/NTPD";
}

function hasSignal(row: unknown[]) {
  return row.some((cell) => clean(cell)) && (row.some((cell) => numberValue(cell) !== 0) || row.some((cell) => /ntpn|ntpd|kompensasi|lebih bayar|pph|ppn|pb\s*1/i.test(clean(cell))));
}

function rowToRecords(row: unknown[], sheet: string, idx: number, headers?: string[]) {
  const lower = (headers ?? []).map((h) => h.toLowerCase());
  const at = (...keys: string[]) => lower.findIndex((h) => keys.some((k) => h.includes(k)));
  const companyIdx = at("perusahaan", "company", "nama perusahaan");
  const periodIdx = at("masa", "periode", "bulan", "period");
  const typeIdx = at("jenis", "pajak", "tax type", "kategori");
  const dppIdx = at("dpp", "dasar");
  const taxIdx = at("nilai pajak", "pajak terhutang", "jumlah pajak", "amount", "ppn", "pembayaran");
  const ntpnIdx = at("ntpn", "ntpd", "bukti");
  const noteIdx = at("keterangan", "catatan", "note", "status");
  const fallbackType = taxTypeFromText(row.join(" "), sheet);
  const company = clean(row[companyIdx >= 0 ? companyIdx : 0]) || "Perusahaan Belum Diisi";
  const period = normalizePeriod(row[periodIdx >= 0 ? periodIdx : 1]);
  const note = clean(row[noteIdx >= 0 ? noteIdx : row.length - 1]);
  const ntpnNtpd = clean(row[ntpnIdx >= 0 ? ntpnIdx : row.length - 1]);
  const makeRecord = (taxType: TaxType, dpp: unknown, tax: unknown, ntpn: unknown = ntpnNtpd) => {
    const taxAmount = numberValue(tax);
    const dppAmount = numberValue(dpp);
    return {
      id: `${sheet}-${idx}-${taxType}-${crypto.randomUUID()}`,
      company,
      period,
      year: periodYear(period),
      taxType,
      dpp: dppAmount,
      taxAmount,
      ntpnNtpd: clean(ntpn),
      status: paymentStatus(taxAmount, dppAmount, clean(ntpn), note),
      note,
      sourceSheet: sheet,
      sourceRow: idx + 1,
    } satisfies TaxTransaction;
  };
  if (headers && companyIdx >= 0) return [makeRecord(fallbackType ?? taxTypeFromText(row[typeIdx], sheet) ?? "PPh Pasal 21", row[dppIdx], row[taxIdx])];
  if (/ppn/i.test(sheet)) {
    const outputVat = numberValue(row[3]);
    const inputVat = numberValue(row[5]);
    return [{ ...makeRecord("PPN", row[2], row[8] ?? outputVat - inputVat, row[10]), outputVat, inputVat }];
  }
  return [
    makeRecord("PPh Pasal 21", row[2], row[3], row[4]),
    makeRecord("PPh Pasal 23", row[5], row[6], row[7]),
    makeRecord("PPh Final Pasal 4 ayat 2", row[8], row[9], row[10]),
    makeRecord("PB 1", row[11], row[12], row[13]),
    makeRecord("PPh UMKM", row[14], row[15], row[16]),
  ].filter((r) => r.dpp || r.taxAmount || r.ntpnNtpd || r.note);
}

function parseWorkbook(wb: XLSX.WorkBook) {
  return wb.SheetNames.flatMap((sheet) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, blankrows: false });
    const headerRow = aoa.findIndex((row) => row.some((cell) => /perusahaan|company|masa|jenis pajak|dpp|ntpn|ntpd/i.test(clean(cell))));
    const headers = headerRow >= 0 ? aoa[headerRow].map(clean) : undefined;
    return aoa.slice(headerRow >= 0 ? headerRow + 1 : 1).filter(hasSignal).flatMap((row, i) => rowToRecords(row, sheet, i + (headerRow >= 0 ? headerRow + 1 : 1), headers));
  });
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}
function shortRp(value: number) {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}
function statusTone(status: string) {
  if (status === "Sudah ada NTPN/NTPD") return "success";
  if (status === "Belum ada NTPN/NTPD" || status === "Data kosong") return "warning";
  if (status === "Kompensasi lebih bayar") return "destructive";
  return "secondary";
}
function groupSum<T extends string>(rows: TaxTransaction[], key: (row: TaxTransaction) => T) {
  return Array.from(rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + r.taxAmount), new Map<T, number>())).map(([name, value]) => ({ name, value }));
}

export function TaxCoordinatorDashboard() {
  const [records, setRecords] = useState<TaxTransaction[]>([]);
  const [page, setPage] = useState<Page>("summary");
  const [filters, setFilters] = useState<Filters>({ year: ALL, period: ALL, company: ALL, taxType: ALL, status: ALL });
  const [message, setMessage] = useState("Upload file Excel sumber pajak untuk membangun dashboard baru dari data workbook.");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setRecords(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as TaxTransaction[]), []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(records)), [records]);
  const filtered = useMemo(() => records.filter((r) => (filters.year === ALL || r.year === filters.year) && (filters.period === ALL || r.period === filters.period) && (filters.company === ALL || r.company === filters.company) && (filters.taxType === ALL || r.taxType === filters.taxType) && (filters.status === ALL || r.status === filters.status)), [records, filters]);
  const periods = Array.from(new Set(records.map((r) => r.period))).sort((a, b) => periodSort(a) - periodSort(b));
  const years = Array.from(new Set(records.map((r) => r.year))).sort();
  const companies = Array.from(new Set(records.map((r) => r.company))).sort();
  const periodText = periods.length ? `${periods[0]} sampai ${periods.at(-1)}` : "Jan-26 sampai bulan terakhir di Excel";
  const totals = {
    dpp: filtered.reduce((a, r) => a + r.dpp, 0),
    tax: filtered.reduce((a, r) => a + r.taxAmount, 0),
    pph: filtered.filter((r) => PPH_TYPES.includes(r.taxType)).reduce((a, r) => a + r.taxAmount, 0),
    ppn: filtered.filter((r) => r.taxType === "PPN").reduce((a, r) => a + r.taxAmount, 0),
    pb1: filtered.filter((r) => r.taxType === "PB 1").reduce((a, r) => a + r.taxAmount, 0),
  };
  const taxByType = TAX_TYPES.map((type) => ({ name: type, value: filtered.filter((r) => r.taxType === type).reduce((a, r) => a + r.taxAmount, 0) }));
  const trend = periods.map((period) => ({ period, ...Object.fromEntries(TAX_TYPES.map((type) => [type, filtered.filter((r) => r.period === period && r.taxType === type).reduce((a, r) => a + r.taxAmount, 0)])) }));
  const byCompany = groupSum(filtered, (r) => r.company).sort((a, b) => b.value - a.value).slice(0, 10);
  const statusData = groupSum(filtered, (r) => r.status);
  const alerts = [
    ...filtered.filter((r) => r.taxAmount === 0).slice(0, 3).map((r) => `Nilai pajak 0: ${r.company} ${r.period} ${r.taxType}`),
    ...filtered.filter((r) => r.taxAmount < 0).slice(0, 3).map((r) => `Pajak negatif/LB: ${r.company} ${r.period} ${r.taxType}`),
    ...filtered.filter((r) => !r.ntpnNtpd).slice(0, 3).map((r) => `NTPN/NTPD kosong: ${r.company} ${r.period} ${r.taxType}`),
    totals.tax ? `Perusahaan pajak tertinggi: ${byCompany[0]?.name ?? "-"}` : "Belum ada data transaksi",
    totals.tax ? `Jenis pajak terbesar: ${taxByType.toSorted((a, b) => b.value - a.value)[0]?.name}` : "Upload Excel untuk melihat highlight otomatis",
  ];
  const detailRows = page === "pph" ? filtered.filter((r) => PPH_TYPES.includes(r.taxType)) : page === "ppn" ? filtered.filter((r) => r.taxType === "PPN") : page === "pb1" ? filtered.filter((r) => r.taxType === "PB 1") : filtered;

  function updateFilter(key: keyof Filters, value: string) { setFilters((cur) => ({ ...cur, [key]: value })); }
  function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = parseWorkbook(XLSX.read(reader.result, { type: "array", cellDates: false }));
      setRecords(imported);
      setMessage(`Berhasil normalisasi ${imported.length} transaksi pajak dari ${file.name}. Struktur dashboard dibuat dari sheet Excel yang diupload.`);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }
  function exportCsv() {
    const rows = filtered.map((r) => ({ Perusahaan: r.company, "Masa Pajak": r.period, "Jenis Pajak": r.taxType, DPP: r.dpp, Pajak: r.taxAmount, "NTPN/NTPD": r.ntpnNtpd, Status: r.status, Keterangan: r.note, Sheet: r.sourceSheet }));
    const keys = Object.keys(rows[0] ?? { Info: "Tidak ada data" });
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String((r as Record<string, unknown>)[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "normalized-tax-dashboard.csv";
    a.click();
  }

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <section className="border-b bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]"><Database className="h-4 w-4" /> Summary All Tax Payment</p><h1 className="text-4xl font-black">Dashboard Monitoring Pembayaran Pajak</h1><p className="mt-2 text-blue-100">Ringkasan Pembayaran Pajak Seluruh Perusahaan • Periode data: {periodText}</p></div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Upload Excel</Button><Button variant="outline" className="bg-white text-slate-950 hover:bg-slate-100" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button><Input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" /></div>
        </div>
        <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur md:grid-cols-5"><Filter className="hidden h-5 w-5 self-center text-blue-100 md:block" />{[["year", years], ["period", periods], ["company", companies], ["taxType", TAX_TYPES], ["status", ["Sudah ada NTPN/NTPD", "Belum ada NTPN/NTPD", "Kompensasi lebih bayar", "Data kosong", "Nilai pajak 0"]]].map(([key, values]) => <Select key={key as string} value={filters[key as keyof Filters]} onChange={(e) => updateFilter(key as keyof Filters, e.target.value)}><option>{ALL}</option>{(values as readonly string[]).map((v) => <option key={v}>{v}</option>)}</Select>)}</div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap gap-2">{[["summary", "Halaman 1 — Summary"], ["pph", "Halaman 2 — Detail PPh"], ["ppn", "Halaman 3 — Detail PPN"], ["pb1", "Halaman 4 — Detail PB 1"], ["quality", "Halaman 5 — Data Quality"]].map(([id, label]) => <Button key={id} variant={page === id ? "default" : "outline"} onClick={() => setPage(id as Page)}>{label}</Button>)}</div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800"><FileSpreadsheet className="mr-2 inline h-4 w-4" />{message}</div>
      {page === "summary" && <Summary totals={totals} filtered={filtered} taxByType={taxByType} trend={trend} byCompany={byCompany} statusData={statusData} alerts={alerts} />}
      {page === "pph" && <Detail title="Detail PPh" rows={detailRows} chartTypes={PPH_TYPES as TaxType[]} />}
      {page === "ppn" && <Detail title="Detail PPN" rows={detailRows} chartTypes={["PPN"]} ppn />}
      {page === "pb1" && <Detail title="Detail PB 1" rows={detailRows} chartTypes={["PB 1"]} />}
      {page === "quality" && <Quality rows={filtered} periods={periods} companies={companies} />}
    </section>
  </main>;
}

function Kpi({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{typeof value === "number" ? rupiah(value) : value}</p></CardContent></Card>; }
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="h-80">{children}</CardContent></Card>; }
function Summary({ totals, filtered, taxByType, trend, byCompany, statusData, alerts }: { totals: { dpp: number; tax: number; pph: number; ppn: number; pb1: number }; filtered: TaxTransaction[]; taxByType: { name: string; value: number }[]; trend: Record<string, string | number>[]; byCompany: { name: string; value: number }[]; statusData: { name: string; value: number }[]; alerts: string[] }) {
  return <><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Kpi label="Total DPP seluruh pajak" value={totals.dpp} /><Kpi label="Total nilai pajak" value={totals.tax} /><Kpi label="Total PPh" value={totals.pph} /><Kpi label="Total PPN" value={totals.ppn} /><Kpi label="Total PB 1" value={totals.pb1} /><Kpi label="Jumlah perusahaan" value={new Set(filtered.map((r) => r.company)).size.toLocaleString("id-ID")} /><Kpi label="Jumlah transaksi pajak" value={filtered.length.toLocaleString("id-ID")} /><Kpi label="Sudah ada NTPN/NTPD" value={filtered.filter((r) => r.status === "Sudah ada NTPN/NTPD").length.toLocaleString("id-ID")} /><Kpi label="Belum ada NTPN/NTPD" value={filtered.filter((r) => r.status === "Belum ada NTPN/NTPD").length.toLocaleString("id-ID")} /><Kpi label="Kompensasi lebih bayar" value={filtered.filter((r) => r.status === "Kompensasi lebih bayar").length.toLocaleString("id-ID")} /></section>
  <section className="grid gap-6 xl:grid-cols-2"><ChartCard title="Ringkasan Nilai Pajak per Jenis Pajak"><ResponsiveContainer><BarChart data={taxByType}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={80} /><YAxis tickFormatter={(v) => shortRp(Number(v))} /><Tooltip formatter={(v) => rupiah(Number(v))} /><Bar dataKey="value" name="Nilai Pajak" fill="#1d4ed8" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Komposisi Pembayaran Pajak"><ResponsiveContainer><PieChart><Pie data={taxByType} dataKey="value" nameKey="name" outerRadius={110} label>{taxByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => rupiah(Number(v))} /><Legend /></PieChart></ResponsiveContainer></ChartCard></section>
  <ChartCard title="Tren Pembayaran Pajak Bulanan"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis tickFormatter={(v) => shortRp(Number(v))} /><Tooltip formatter={(v) => rupiah(Number(v))} /><Legend />{TAX_TYPES.map((type, i) => <Line key={type} type="monotone" dataKey={type} stroke={COLORS[i]} strokeWidth={2} />)}</LineChart></ResponsiveContainer></ChartCard>
  <section className="grid gap-6 xl:grid-cols-3"><ChartCard title="Ranking Perusahaan"><ResponsiveContainer><BarChart data={byCompany} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => shortRp(Number(v))} /><YAxis type="category" dataKey="name" width={170} /><Tooltip formatter={(v) => rupiah(Number(v))} /><Bar dataKey="value" fill="#0f766e" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Status NTPN / NTPD"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" outerRadius={105} label>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></ChartCard><Card><CardHeader><CardTitle>Alert / Highlight</CardTitle></CardHeader><CardContent className="space-y-3">{alerts.map((a) => <div key={a} className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{a}</div>)}</CardContent></Card></section><TransactionTable title="Tabel Detail Ringkas" rows={filtered.slice(0, 100)} /></>;
}
function Detail({ title, rows, chartTypes, ppn = false }: { title: string; rows: TaxTransaction[]; chartTypes: TaxType[]; ppn?: boolean }) { const trend = Array.from(new Set(rows.map((r) => r.period))).sort((a, b) => periodSort(a) - periodSort(b)).map((period) => ({ period, pajak: rows.filter((r) => r.period === period).reduce((a, r) => a + r.taxAmount, 0), keluaran: rows.filter((r) => r.period === period).reduce((a, r) => a + (r.outputVat ?? 0), 0), masukan: rows.filter((r) => r.period === period).reduce((a, r) => a + (r.inputVat ?? 0), 0) })); return <><section className="grid gap-4 md:grid-cols-4"><Kpi label="Total DPP" value={rows.reduce((a, r) => a + r.dpp, 0)} /><Kpi label={ppn ? "Kurang bayar / lebih bayar" : "Total Pajak"} value={rows.reduce((a, r) => a + r.taxAmount, 0)} /><Kpi label={ppn ? "Pajak keluaran" : "Jumlah NTPN/NTPD"} value={(ppn ? rows.reduce((a, r) => a + (r.outputVat ?? 0), 0) : rows.filter((r) => r.ntpnNtpd).length).toLocaleString("id-ID")} /><Kpi label={ppn ? "Pajak masukan" : "Transaksi"} value={(ppn ? rows.reduce((a, r) => a + (r.inputVat ?? 0), 0) : rows.length).toLocaleString("id-ID")} /></section><section className="grid gap-6 xl:grid-cols-2"><ChartCard title={`${title} — tren bulanan`}><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis tickFormatter={(v) => shortRp(Number(v))} /><Tooltip formatter={(v) => rupiah(Number(v))} /><Legend /><Line dataKey="pajak" stroke="#1d4ed8" />{ppn && <><Line dataKey="keluaran" stroke="#16a34a" /><Line dataKey="masukan" stroke="#f97316" /></>}</LineChart></ResponsiveContainer></ChartCard><ChartCard title={`${title} — perbandingan perusahaan`}><ResponsiveContainer><BarChart data={groupSum(rows, (r) => r.company).sort((a, b) => b.value - a.value)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis tickFormatter={(v) => shortRp(Number(v))} /><Tooltip formatter={(v) => rupiah(Number(v))} /><Bar dataKey="value" fill="#0f766e" /></BarChart></ResponsiveContainer></ChartCard></section><ChartCard title={`${title} — status pembayaran`}><ResponsiveContainer><BarChart data={groupSum(rows, (r) => r.status)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#1d4ed8" /></BarChart></ResponsiveContainer></ChartCard><TransactionTable title={`Tabel detail ${chartTypes.join(", ")}`} rows={rows} /></>; }
function Quality({ rows, periods, companies }: { rows: TaxTransaction[]; periods: string[]; companies: string[] }) { const issues = rows.filter((r) => !r.ntpnNtpd || r.taxAmount <= 0 || r.status === "Kompensasi lebih bayar" || !r.dpp); const missing = companies.flatMap((company) => periods.filter((period) => !rows.some((r) => r.company === company && r.period === period)).map((period) => ({ company, period }))).slice(0, 40); return <><section className="grid gap-4 md:grid-cols-4"><Kpi label="NTPN/NTPD kosong" value={rows.filter((r) => !r.ntpnNtpd).length.toLocaleString("id-ID")} /><Kpi label="Pajak 0" value={rows.filter((r) => r.taxAmount === 0).length.toLocaleString("id-ID")} /><Kpi label="Pajak negatif" value={rows.filter((r) => r.taxAmount < 0).length.toLocaleString("id-ID")} /><Kpi label="Kompensasi lebih bayar" value={rows.filter((r) => r.status === "Kompensasi lebih bayar").length.toLocaleString("id-ID")} /></section><TransactionTable title="Data yang perlu dicek ulang oleh accounting" rows={issues} /><Card><CardHeader><CardTitle>Masa pajak / perusahaan belum lengkap</CardTitle><CardDescription>Pasangan perusahaan dan masa pajak yang belum memiliki transaksi pada data terfilter.</CardDescription></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{missing.map((m) => <div key={`${m.company}-${m.period}`} className="rounded-lg bg-slate-50 p-3 text-sm font-semibold"><AlertTriangle className="mr-2 inline h-4 w-4 text-orange-500" />{m.company} — {m.period}</div>)}</CardContent></Card></>; }
function TransactionTable({ title, rows }: { title: string; rows: TaxTransaction[] }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{rows.length} transaksi pajak.</CardDescription></CardHeader><CardContent className="overflow-auto"><Table><TableHeader><TableRow>{["Perusahaan", "Masa pajak", "Jenis pajak", "DPP", "Pajak", "NTPN/NTPD", "Status", "Keterangan"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell className="min-w-56 font-semibold">{r.company}</TableCell><TableCell>{r.period}</TableCell><TableCell>{r.taxType}</TableCell><TableCell className={r.dpp < 0 ? "text-red-600" : ""}>{rupiah(r.dpp)}</TableCell><TableCell className={r.taxAmount < 0 ? "font-bold text-red-600" : ""}>{rupiah(r.taxAmount)}</TableCell><TableCell>{r.ntpnNtpd || "-"}</TableCell><TableCell><Badge variant={statusTone(r.status)}>{r.status === "Sudah ada NTPN/NTPD" && <CheckCircle2 className="mr-1 h-3 w-3" />}{r.status}</Badge></TableCell><TableCell className="min-w-72">{r.note || `${r.sourceSheet} baris ${r.sourceRow}`}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>; }
