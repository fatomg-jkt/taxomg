"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { BadgeDollarSign, ChevronDown, Cloud, FileSpreadsheet, Percent, PiggyBank, Plus, ShieldCheck, Target, Trash2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CASHFLOW_BRANDS, CASHFLOW_DEPARTMENTS, EMPTY_CASHFLOW, normalizeCashflow, safeAmount, type CashflowData, type CashflowEntry } from "@/lib/cashflow";

export type CashflowPage = "cashflow" | "cashflowProjection" | "cashflowActual";
const WEEKS = Array.from({ length: 27 }, (_, index) => `Week ${index + 26}`);
const DEPARTMENT_COLORS = ["#2563EB", "#10B981", "#F97316", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#EAB308"];
const CASHFLOW_KINDS = ["Fix Cost", "Project Cost", "Asset"] as const;
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const percent = (actual: number, projection: number) => projection ? actual / projection * 100 : 0;
const status = (projection: number, actual: number) => !projection && !actual ? "Belum Ada Data" : actual <= projection ? "Under Cashflow" : "Over Cashflow";
const statusClass = (value: string) => value === "Under Cashflow" ? "bg-emerald-100 text-emerald-700" : value === "Over Cashflow" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";
const emptyEntry = (): CashflowEntry => ({ id: "", brand: "", department: "", paymentItem: "", description: "", type: "", nominal: 0, date: "", week: "", source: "Manual Input", notes: "" });

export function CashflowDashboard({ page, verifyPassword }: { page: CashflowPage; verifyPassword: () => Promise<string | null> }) {
  const [data, setData] = useState<CashflowData>(EMPTY_CASHFLOW);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/cashflow-data", { cache: "no-store" }).then((r) => r.json()).then((p) => setData(normalizeCashflow(p.cashflowData))).catch(() => setNotice("Data cloud tidak dapat dimuat. Empty state digunakan.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (loading) return; localStorage.setItem("cashflowProjectionData", JSON.stringify(data.projection)); localStorage.setItem("cashflowActualData", JSON.stringify(data.actual)); localStorage.setItem("cashflowBankMutationData", JSON.stringify(data.bankMutation)); localStorage.setItem("cashflowData", JSON.stringify(data)); }, [data, loading]);
  async function save() { const password = await verifyPassword(); if (!password) return; setSaving(true); setNotice(""); try { const response = await fetch("/api/cashflow-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ cashflowData: data }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setData((current) => ({ ...current, lastUpdated: payload.updatedAt })); setNotice("Cashflow berhasil disimpan ke cloud secara terpisah."); } catch (error) { setNotice(error instanceof Error ? error.message : "Save to Cloud gagal."); } finally { setSaving(false); } }
  if (loading) return <Card className="rounded-3xl"><CardContent className="p-8 text-center text-slate-500">Memuat data Cashflow...</CardContent></Card>;
  return <div className="space-y-5">{notice && <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700">{notice}</div>}{page === "cashflow" ? <CashflowOverview data={data} onSave={save} saving={saving} /> : <CashflowEditor page={page} data={data} setData={setData} onSave={save} saving={saving} />}</div>;
}

function normalizedFilter(value: string) { return value.trim().toLocaleLowerCase("id-ID"); }
function periodLabel(value: string) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (iso) return `${iso[2]}-${iso[1]}`;
  const display = text.match(/^(\d{2})[-/](\d{4})$/);
  return display ? `${display[1]}-${display[2]}` : text;
}
function uniqueOptions(values: string[]) { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id")); }

function CashflowFilter({ value, placeholder, options, onChange }: { value: string; placeholder: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const query = normalizedFilter(value);
  const visibleOptions = options.filter((option) => !query || normalizedFilter(option).includes(query));
  return <div className="relative min-w-40 flex-1">
    <Input
      value={value}
      onChange={(event) => { onChange(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      placeholder={placeholder}
      autoComplete="off"
      className="h-11 rounded-xl bg-white pr-9"
    />
    <ChevronDown className={`pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
    {open && <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 max-h-[108px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setOpen(false); }} className="block h-9 w-full px-3 text-left text-sm font-semibold text-slate-600 hover:bg-blue-50">Semua</button>
      {visibleOptions.map((option) => <button key={option} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setOpen(false); }} className="block h-9 w-full truncate px-3 text-left text-sm text-slate-700 hover:bg-blue-50">{option}</button>)}
      {!visibleOptions.length && <p className="flex h-9 items-center px-3 text-sm text-slate-400">Tidak ada saran</p>}
    </div>}
  </div>;
}

function CashflowOverview({ data, onSave, saving }: { data: CashflowData; onSave: () => void; saving: boolean }) {
  const [filters, setFilters] = useState({ period: "", brand: "", week: "", department: "", type: "" });
  const allRows = [...data.projection, ...data.actual];
  const filterOptions = {
    period: uniqueOptions(allRows.map((row) => periodLabel(row.date))),
    brand: uniqueOptions([...CASHFLOW_BRANDS, ...allRows.map((row) => row.brand)]),
    week: uniqueOptions([...WEEKS, ...allRows.map((row) => row.week)]),
    department: uniqueOptions([...CASHFLOW_DEPARTMENTS, ...allRows.map((row) => row.department)]),
    type: [...CASHFLOW_KINDS],
  };
  const contains = (source: string, filter: string) => !normalizedFilter(filter) || normalizedFilter(source).includes(normalizedFilter(filter));
  const matches = (row: CashflowEntry) => contains(row.brand, filters.brand) && contains(row.week, filters.week) && contains(row.department, filters.department) && contains(row.type, filters.type) && contains(periodLabel(row.date), filters.period);
  const projection = data.projection.filter(matches);
  const actual = data.actual.filter(matches);
  const totalProjection = projection.reduce((sum, row) => sum + safeAmount(row.nominal), 0); const totalActual = actual.reduce((sum, row) => sum + safeAmount(row.nominal), 0); const remaining = totalProjection - totalActual; const realization = percent(totalActual, totalProjection); const budgetStatus = status(totalProjection, totalActual);
  const group = (key: "type" | "department") => Array.from(new Set([...projection.map((r) => r[key]), ...actual.map((r) => r[key])].map((value) => value.trim()).filter(Boolean))).map((name) => { const projected = projection.filter((r) => normalizedFilter(r[key]) === normalizedFilter(name)).reduce((s, r) => s + safeAmount(r.nominal), 0); const realized = actual.filter((r) => normalizedFilter(r[key]) === normalizedFilter(name)).reduce((s, r) => s + safeAmount(r.nominal), 0); return { name, projected, realized, difference: projected - realized }; });
  const types = group("type"), departments = group("department");
  const chartRows = (types.length ? types : departments).map((row) => ({ name: row.name, Proyeksi: row.projected, Realisasi: row.realized }));
  const departmentComposition = departments.filter((row) => row.realized > 0).map((row) => ({ name: row.name, value: row.realized }));
  const departmentTotal = departmentComposition.reduce((sum, row) => sum + row.value, 0);
  const statusAccent = budgetStatus === "Under Cashflow" ? "border-emerald-500 bg-emerald-50/60 text-emerald-700" : budgetStatus === "Over Cashflow" ? "border-red-500 bg-red-50/60 text-red-700" : "border-slate-400 bg-slate-50 text-slate-600";
  const kpis = [
    { label: "Total Proyeksi", value: rupiah(totalProjection), Icon: Target, accent: "border-blue-600 bg-blue-50/60 text-blue-700", icon: "bg-blue-100 text-blue-600" },
    { label: "Total Realisasi", value: rupiah(totalActual), Icon: BadgeDollarSign, accent: "border-emerald-500 bg-emerald-50/60 text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
    { label: "Sisa Cashflow", value: rupiah(remaining), Icon: PiggyBank, accent: "border-amber-500 bg-amber-50/60 text-amber-700", icon: "bg-amber-100 text-amber-600" },
    { label: "% Realisasi", value: `${realization.toFixed(1)}%`, Icon: Percent, accent: "border-violet-500 bg-violet-50/60 text-violet-700", icon: "bg-violet-100 text-violet-600" },
    { label: "Status Cashflow", value: budgetStatus, Icon: ShieldCheck, accent: statusAccent, icon: budgetStatus === "Under Cashflow" ? "bg-emerald-100 text-emerald-600" : budgetStatus === "Over Cashflow" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500" },
  ];
  const summaries = [["Total Cashflow / Proyeksi", rupiah(totalProjection), "border-blue-500 bg-blue-50/60"], ["Actual Spending / Realisasi", rupiah(totalActual), "border-emerald-500 bg-emerald-50/60"], ["Cashflow Remaining / Sisa Cashflow", rupiah(remaining), "border-amber-500 bg-amber-50/60"], ["% Realisasi", `${realization.toFixed(1)}%`, "border-violet-500 bg-violet-50/60"], ["Status", budgetStatus, statusAccent]];
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  return <><Card className="rounded-3xl"><CardContent className="flex flex-wrap gap-3 p-4">
      <CashflowFilter value={filters.period} placeholder="Periode mm-yyyy" options={filterOptions.period} onChange={(value) => setFilter("period", value.replace(/[^\d-]/g, "").slice(0, 7))} />
      <CashflowFilter value={filters.brand} placeholder="Semua Brand" options={filterOptions.brand} onChange={(value) => setFilter("brand", value)} />
      <CashflowFilter value={filters.week} placeholder="Semua Week" options={filterOptions.week} onChange={(value) => setFilter("week", value)} />
      <CashflowFilter value={filters.department} placeholder="Semua Departemen" options={filterOptions.department} onChange={(value) => setFilter("department", value)} />
      <CashflowFilter value={filters.type} placeholder="JENIS" options={filterOptions.type} onChange={(value) => setFilter("type", value)} />
      <Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-xl font-bold"><Cloud className="h-4 w-4" /> {saving ? "Menyimpan..." : "Save to Cloud"}</Button>
    </CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{kpis.map(({ label, value, Icon, accent, icon }) => <Card key={label} className={`rounded-3xl border-t-4 ${accent}`}><CardContent className="p-5"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${icon}`}><Icon className="h-5 w-5" /></div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-xl font-black text-slate-900">{label === "Status Cashflow" ? <Badge className={statusClass(value)}>{value}</Badge> : value}</p></CardContent></Card>)}</div>
    <Card className="rounded-3xl"><CardHeader><CardTitle>Ringkasan Arus Kas</CardTitle><CardDescription>Perbandingan cashflow dan actual spending sesuai filter.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summaries.map(([label,value,accent]) => <div key={label} className={`rounded-2xl border-l-4 p-4 ${accent}`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 font-black text-slate-900">{label === "Status" ? <Badge className={statusClass(value)}>{value}</Badge> : value}</p></div>)}</CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="overflow-hidden rounded-3xl border-blue-100 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Grafik Proyeksi vs Realisasi</CardTitle><CardDescription>Perbandingan nominal sesuai filter Cashflow yang aktif.</CardDescription></div><span className="shrink-0 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">Comparison</span></CardHeader><CardContent>{chartRows.length ? <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 8 }}><defs><linearGradient id="projectionBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#60A5FA" /></linearGradient><linearGradient id="actualBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#34D399" /></linearGradient></defs><CartesianGrid stroke="#CBD5E1" strokeDasharray="4 6" vertical={false} opacity={0.7} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(value) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} /><Tooltip cursor={{ fill: "#DBEAFE", opacity: 0.35 }} contentStyle={{ border: "1px solid #BFDBFE", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,.12)" }} formatter={(value) => rupiah(Number(value))} /><Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} /><Bar dataKey="Proyeksi" fill="url(#projectionBar)" radius={[10,10,3,3]} maxBarSize={58} /><Bar dataKey="Realisasi" fill="url(#actualBar)" radius={[10,10,3,3]} maxBarSize={58} /></BarChart></ResponsiveContainer></div> : <div className="grid h-52 place-items-center rounded-2xl border border-dashed border-blue-200 bg-white/60 text-sm font-semibold text-slate-500">Belum ada data sesuai filter untuk ditampilkan pada grafik.</div>}</CardContent></Card>
      <Card className="overflow-hidden rounded-3xl border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Komposisi Departemen</CardTitle><CardDescription>Distribusi realisasi Cashflow berdasarkan departemen sesuai filter aktif.</CardDescription></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">{departmentComposition.length} Departemen</span></CardHeader><CardContent>{departmentComposition.length ? <div className="grid min-h-80 items-center gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(220px,.95fr)]"><div className="relative h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={departmentComposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={108} paddingAngle={3} cornerRadius={8} stroke="#FFFFFF" strokeWidth={3}>{departmentComposition.map((row,index)=><Cell key={row.name} fill={DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ border: "1px solid #A7F3D0", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,.12)" }} formatter={(value) => rupiah(Number(value))} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Total Realisasi</p><p className="mt-1 whitespace-nowrap text-lg font-black tracking-tight text-slate-950">{rupiah(departmentTotal)}</p><p className="mt-1 text-[11px] font-bold text-emerald-600">100% Cashflow</p></div></div><div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">{departmentComposition.map((row,index)=>{const share=departmentTotal ? row.value / departmentTotal * 100 : 0; const color=DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]; return <div key={row.name} className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white" style={{backgroundColor:color}}/><p className="truncate text-sm font-extrabold text-slate-800">{row.name}</p></div><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{color,backgroundColor:`${color}18`}}>{share.toFixed(1)}%</span></div><div className="mt-2 flex items-center justify-between gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{width:`${Math.max(share,2)}%`,backgroundColor:color}}/></div><p className="shrink-0 text-xs font-bold text-slate-500">{rupiah(row.value)}</p></div></div>})}</div></div> : <div className="grid h-52 place-items-center rounded-2xl border border-dashed border-emerald-200 bg-white/60 text-sm font-semibold text-slate-500">Belum ada data realisasi departemen sesuai filter.</div>}</CardContent></Card>
    </div>
    <Breakdown title="Detail per Jenis Biaya" heading="Jenis Biaya" rows={types} />
    <Breakdown title="Detail per Departemen" heading="Departemen" rows={departments} />
    <Card className="rounded-3xl"><CardHeader><CardTitle>Analisis Penyebab Over Cashflow</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Departemen","Proyeksi","Realisasi","Selisih","Top Penyebab Over Cashflow"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{departments.filter((r)=>r.realized>r.projected).map((r)=><TableRow key={r.name}><TableCell className="font-bold">{r.name}</TableCell><TableCell>{rupiah(r.projected)}</TableCell><TableCell>{rupiah(r.realized)}</TableCell><TableCell className="text-red-600">{rupiah(r.difference)}</TableCell><TableCell>{actual.filter((a)=>normalizedFilter(a.department)===normalizedFilter(r.name)).sort((a,b)=>b.nominal-a.nominal)[0]?.description || "-"}</TableCell></TableRow>)}{!departments.some((r)=>r.realized>r.projected)&&<EmptyRow span={5}/>}</TableBody></Table></CardContent></Card></>;
}

function Breakdown({ title, heading, rows }: { title: string; heading: string; rows: { name: string; projected: number; realized: number; difference: number }[] }) { return <Card className="rounded-3xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{[heading,"Proyeksi","Realisasi","Selisih","% Realisasi","Status"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r)=><TableRow key={r.name}><TableCell className="font-bold">{r.name}</TableCell><TableCell>{rupiah(r.projected)}</TableCell><TableCell>{rupiah(r.realized)}</TableCell><TableCell>{rupiah(r.difference)}</TableCell><TableCell>{percent(r.realized,r.projected).toFixed(1)}%</TableCell><TableCell><Badge className={statusClass(status(r.projected,r.realized))}>{status(r.projected,r.realized)}</Badge></TableCell></TableRow>)}{!rows.length&&<EmptyRow span={6}/>}</TableBody></Table></CardContent></Card>; }

function CashflowEditor({ page, data, setData, onSave, saving }: { page: CashflowPage; data: CashflowData; setData: (data: CashflowData) => void; onSave: () => void; saving: boolean }) {
  const key = page === "cashflowProjection" ? "projection" : "actual";
  const [modal, setModal] = useState(false); const [entry, setEntry] = useState<CashflowEntry>(emptyEntry); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); const fileInput = useRef<HTMLInputElement>(null);
  const rows = data[key]; const title = page === "cashflowProjection" ? "Proyeksi" : "Realisasi";
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  function submit() { const row = { ...entry, id: entry.id || `cashflow-${crypto.randomUUID()}` }; setData({ ...data, [key]: entry.id ? rows.map((r)=>r.id===entry.id?row:r) : [...rows,row] }); setModal(false); }
  function remove(id: string) { if (!confirm("Hapus data ini?")) return; setData({ ...data, [key]: rows.filter((r)=>r.id!==id) }); setSelectedIds((current)=>{const next=new Set(current); next.delete(id); return next;}); }
  function toggleSelected(id: string) { setSelectedIds((current)=>{const next=new Set(current); if(next.has(id)) next.delete(id); else next.add(id); return next;}); }
  function toggleAll() { setSelectedIds(allSelected ? new Set() : new Set(rows.map((row)=>row.id))); }
  function removeSelected() { if (!selectedIds.size || !confirm(`Hapus ${selectedIds.size} data terpilih?`)) return; setData({ ...data, [key]: rows.filter((row)=>!selectedIds.has(row.id)) }); setSelectedIds(new Set()); }
  async function upload(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!file.name.toLowerCase().endsWith(".xlsx")) { alert("Hanya file Excel .xlsx yang dapat diunggah."); return; } try { const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; if (!sheet) return; const imported = parseCashflowSheet(sheet, page === "cashflowActual"); setData({ ...data, [key]: [...rows, ...imported] }); } catch { alert("File Excel tidak dapat dibaca. Pastikan format file .xlsx valid."); } }
  return <><input ref={fileInput} type="file" accept=".xlsx" onChange={upload} className="hidden"/><Card className="rounded-3xl"><CardContent className="flex flex-wrap justify-between gap-3 p-4"><div><p className="font-black">Cashflow &gt; {title}</p><p className="text-sm text-slate-500">Input dan kelola data {title.toLowerCase()} cashflow.</p></div><div className="flex flex-wrap gap-2">{selectedIds.size>0&&<Button onClick={removeSelected} variant="outline" className="rounded-xl border-red-200 bg-red-50 font-bold text-red-600 hover:bg-red-100 hover:text-red-700"><Trash2 className="h-4 w-4"/> Hapus Terpilih ({selectedIds.size})</Button>}<Button onClick={()=>{setEntry(emptyEntry()); setModal(true)}} className="rounded-xl bg-blue-600"><Plus className="h-4 w-4"/> Tambah Data {title}</Button><Button onClick={()=>fileInput.current?.click()} variant="outline" className="rounded-xl"><FileSpreadsheet className="h-4 w-4"/> Upload Excel</Button><Button onClick={onSave} disabled={saving} variant="outline" className="rounded-xl"><Cloud className="h-4 w-4"/> Save to Cloud</Button></div></CardContent></Card>
  <Card className="overflow-hidden rounded-3xl"><CardContent className="max-h-[68vh] overflow-auto p-0"><Table className="min-w-max"><TableHeader className="sticky top-0 z-10 bg-white"><TableRow><TableHead className="w-12 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Pilih semua data" className="h-4 w-4 cursor-pointer accent-blue-600"/></TableHead>{["No","Brand","Departemen","Deskripsi","JENIS","Nominal","Tanggal","Week",...(page==="cashflowActual"?["Keterangan"]:[]),"Source","Hapus"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,index)=><EntryRow key={row.id} index={index} row={row} actual={page==="cashflowActual"} selected={selectedIds.has(row.id)} onToggle={()=>toggleSelected(row.id)} onEdit={()=>{setEntry(row);setModal(true)}} onDelete={()=>remove(row.id)}/>)}{!rows.length&&<EmptyRow span={page==="cashflowActual"?12:11}/>}</TableBody></Table></CardContent></Card>
  {modal&&<EditorModal title={title} entry={entry} setEntry={setEntry} onClose={()=>setModal(false)} onSave={submit}/>}</>;
}

function EntryRow({ row, index, actual, selected, onToggle, onEdit, onDelete }: { row: CashflowEntry; index:number; actual:boolean; selected:boolean; onToggle:()=>void; onEdit:()=>void; onDelete:()=>void }) { return <TableRow className={selected?"bg-blue-50/70":"cursor-pointer"} onDoubleClick={onEdit}><TableCell className="text-center"><input type="checkbox" checked={selected} onChange={onToggle} onClick={(event)=>event.stopPropagation()} aria-label={`Pilih data nomor ${index+1}`} className="h-4 w-4 cursor-pointer accent-blue-600"/></TableCell><TableCell>{index+1}</TableCell>{[row.brand,row.department,row.description,row.type,rupiah(row.nominal),row.date,row.week,...(actual?[row.notes || "-"]:[]),row.source].map((v,i)=><TableCell key={i}>{v||"-"}</TableCell>)}<TableCell><Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>; }

function EditorModal({ title, entry, setEntry, onClose, onSave }:{title:string;entry:CashflowEntry;setEntry:(v:CashflowEntry)=>void;onClose:()=>void;onSave:()=>void}) { const fields = [["brand","Brand","select",CASHFLOW_BRANDS],["department","Departemen","select",CASHFLOW_DEPARTMENTS],["description","Deskripsi"],["type","JENIS","select",CASHFLOW_KINDS],["nominal","Nominal","number"],["date","Tanggal","date"],["week","Week","select",WEEKS],...(title==="Realisasi"?[["notes","Keterangan"]]:[])]; const update=(key:string,next:string)=>setEntry({...entry,[key]:key==="nominal"?safeAmount(next):next}); return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex justify-between border-b bg-white p-5"><h2 className="text-xl font-black">{entry.id?"Edit":"Tambah"} {title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{fields.map(([key,label,type,options])=><label key={key as string} className="space-y-2"><span className="text-sm font-bold">{label as string}</span>{type==="select"?<Select value={String(entry[key as keyof CashflowEntry]??"")} onChange={(e)=>update(key as string,e.target.value)} className="h-11 w-full rounded-xl"><option value="">Pilih {label as string}</option>{(options as readonly string[]).map((o)=><option key={o}>{o}</option>)}</Select>:<Input type={(type as string)||"text"} min={type==="date"?"2026-01-01":undefined} max={type==="date"?"2026-12-31":undefined} value={String(entry[key as keyof CashflowEntry]??"")} onChange={(e)=>update(key as string,e.target.value)} className="h-11 rounded-xl"/>}</label>)}</div><div className="flex justify-end gap-2 border-t p-5"><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={onSave} className="bg-blue-600">Simpan</Button></div></div></div>; }
function EmptyRow({span}:{span:number}) { return <TableRow><TableCell colSpan={span} className="h-28 text-center font-semibold text-slate-500">Belum ada data. Nilai dihitung sebagai Rp 0.</TableCell></TableRow>; }

function importedAmount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").trim().replace(/rp/gi, "").replace(/\s/g, "");
  if (!cleaned) return 0;
  const normalized = /^[+-]?\d{1,3}([.,]\d{3})+$/.test(cleaned) ? cleaned.replace(/[.,]/g, "") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function importedText(value: unknown, fallback = "") {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseCashflowSheet(sheet: XLSX.WorkSheet, actual: boolean): CashflowEntry[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  return rows.map((source) => {
    const normalized = Object.fromEntries(Object.entries(source).map(([key, value]) => [key.trim().toLowerCase(), value]));
    return {
      id: `cashflow-${crypto.randomUUID()}`,
      brand: importedText(normalized.brand, "-"),
      department: importedText(normalized.departemen, "-"),
      paymentItem: "",
      description: importedText(normalized.deskripsi),
      type: CASHFLOW_KINDS.find((kind) => kind.toLowerCase() === importedText(normalized.jenis).toLowerCase()) ?? "",
      nominal: importedAmount(normalized.nominal),
      date: importedText(normalized.tanggal, "-"),
      week: importedText(normalized.week, "-"),
      source: "Excel Import",
      notes: actual ? importedText(normalized.keterangan) : "",
    };
  });
}
