"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { BadgeDollarSign, Cloud, FileSpreadsheet, Percent, PiggyBank, Plus, ShieldCheck, Target, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CASHFLOW_BRANDS, CASHFLOW_DEPARTMENTS, CASHFLOW_TYPES, EMPTY_CASHFLOW, normalizeCashflow, safeAmount, type CashflowData, type CashflowEntry } from "@/lib/cashflow";

export type CashflowPage = "cashflow" | "cashflowProjection" | "cashflowActual";
const ALL = "__all__";
const WEEKS = Array.from({ length: 27 }, (_, index) => `Week ${index + 26}`);
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const percent = (actual: number, projection: number) => projection ? actual / projection * 100 : 0;
const status = (projection: number, actual: number) => !projection && !actual ? "Belum Ada Data" : actual <= projection ? "Aman" : "Over Budget";
const statusClass = (value: string) => value === "Aman" ? "bg-emerald-100 text-emerald-700" : value === "Over Budget" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";
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

function CashflowOverview({ data, onSave, saving }: { data: CashflowData; onSave: () => void; saving: boolean }) {
  const [filters, setFilters] = useState({ period: ALL, brand: ALL, week: ALL, department: ALL, type: ALL });
  const matches = (row: CashflowEntry) => (filters.brand === ALL || row.brand === filters.brand) && (filters.week === ALL || row.week === filters.week) && (filters.department === ALL || row.department === filters.department) && (filters.type === ALL || row.type === filters.type) && (filters.period === ALL || row.date.startsWith(filters.period));
  const projection = data.projection.filter(matches);
  const actual = data.actual.filter(matches);
  const totalProjection = projection.reduce((sum, row) => sum + safeAmount(row.nominal), 0); const totalActual = actual.reduce((sum, row) => sum + safeAmount(row.nominal), 0); const remaining = totalProjection - totalActual; const realization = percent(totalActual, totalProjection); const budgetStatus = status(totalProjection, totalActual);
  const group = (key: "type" | "department") => Array.from(new Set([...projection.map((r) => r[key]), ...actual.map((r) => r[key])].filter(Boolean))).map((name) => { const projected = projection.filter((r) => r[key] === name).reduce((s, r) => s + safeAmount(r.nominal), 0); const realized = actual.filter((r) => r[key] === name).reduce((s, r) => s + safeAmount(r.nominal), 0); return { name, projected, realized, difference: projected - realized }; });
  const types = group("type"), departments = group("department");
  const statusAccent = budgetStatus === "Aman" ? "border-emerald-500 bg-emerald-50/60 text-emerald-700" : budgetStatus === "Over Budget" ? "border-red-500 bg-red-50/60 text-red-700" : "border-slate-400 bg-slate-50 text-slate-600";
  const kpis = [
    { label: "Total Proyeksi", value: rupiah(totalProjection), Icon: Target, accent: "border-blue-600 bg-blue-50/60 text-blue-700", icon: "bg-blue-100 text-blue-600" },
    { label: "Total Realisasi", value: rupiah(totalActual), Icon: BadgeDollarSign, accent: "border-emerald-500 bg-emerald-50/60 text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
    { label: "Sisa Budget", value: rupiah(remaining), Icon: PiggyBank, accent: "border-amber-500 bg-amber-50/60 text-amber-700", icon: "bg-amber-100 text-amber-600" },
    { label: "% Realisasi", value: `${realization.toFixed(1)}%`, Icon: Percent, accent: "border-violet-500 bg-violet-50/60 text-violet-700", icon: "bg-violet-100 text-violet-600" },
    { label: "Status Budget", value: budgetStatus, Icon: ShieldCheck, accent: statusAccent, icon: budgetStatus === "Aman" ? "bg-emerald-100 text-emerald-600" : budgetStatus === "Over Budget" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500" },
  ];
  const summaries = [["Total Budget / Proyeksi", rupiah(totalProjection), "border-blue-500 bg-blue-50/60"], ["Actual Spending / Realisasi", rupiah(totalActual), "border-emerald-500 bg-emerald-50/60"], ["Budget Remaining / Sisa Budget", rupiah(remaining), "border-amber-500 bg-amber-50/60"], ["% Realisasi", `${realization.toFixed(1)}%`, "border-violet-500 bg-violet-50/60"], ["Status", budgetStatus, statusAccent]];
  return <><Card className="rounded-3xl"><CardContent className="flex flex-wrap gap-3 p-4">{[["period", "Filter Periode", Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)], ["brand", "Semua Brand", CASHFLOW_BRANDS], ["week", "Semua Week", WEEKS], ["department", "Semua Departemen", CASHFLOW_DEPARTMENTS], ["type", "Semua Jenis Transaksi", CASHFLOW_TYPES]] .map(([key, label, values]) => <Select key={key as string} value={filters[key as keyof typeof filters]} onChange={(e) => setFilters({ ...filters, [key as string]: e.target.value })} className="h-11 min-w-40 flex-1 rounded-xl"><option value={ALL}>{label as string}</option>{(values as readonly string[]).map((v) => <option key={v}>{v}</option>)}</Select>)}<Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-xl font-bold"><Cloud className="h-4 w-4" /> {saving ? "Menyimpan..." : "Save to Cloud"}</Button></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{kpis.map(({ label, value, Icon, accent, icon }) => <Card key={label} className={`rounded-3xl border-t-4 ${accent}`}><CardContent className="p-5"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${icon}`}><Icon className="h-5 w-5" /></div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-xl font-black text-slate-900">{label === "Status Budget" ? <Badge className={statusClass(value)}>{value}</Badge> : value}</p></CardContent></Card>)}</div>
    <Card className="rounded-3xl"><CardHeader><CardTitle>Ringkasan Arus Kas</CardTitle><CardDescription>Perbandingan budget dan actual spending sesuai filter.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summaries.map(([label,value,accent]) => <div key={label} className={`rounded-2xl border-l-4 p-4 ${accent}`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 font-black text-slate-900">{label === "Status" ? <Badge className={statusClass(value)}>{value}</Badge> : value}</p></div>)}</CardContent></Card>
    <Breakdown title="Detail per Jenis Biaya" heading="Jenis Biaya" rows={types} />
    <Breakdown title="Detail per Departemen" heading="Departemen" rows={departments} />
    <Card className="rounded-3xl"><CardHeader><CardTitle>Analisis Penyebab Over Budget</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Departemen","Proyeksi","Realisasi","Selisih","Top Penyebab Over Budget"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{departments.filter((r)=>r.realized>r.projected).map((r)=><TableRow key={r.name}><TableCell className="font-bold">{r.name}</TableCell><TableCell>{rupiah(r.projected)}</TableCell><TableCell>{rupiah(r.realized)}</TableCell><TableCell className="text-red-600">{rupiah(r.difference)}</TableCell><TableCell>{actual.filter((a)=>a.department===r.name).sort((a,b)=>b.nominal-a.nominal)[0]?.description || actual.filter((a)=>a.department===r.name)[0]?.paymentItem || "-"}</TableCell></TableRow>)}{!departments.some((r)=>r.realized>r.projected)&&<EmptyRow span={5}/>}</TableBody></Table></CardContent></Card></>;
}

function Breakdown({ title, heading, rows }: { title: string; heading: string; rows: { name: string; projected: number; realized: number; difference: number }[] }) { return <Card className="rounded-3xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{[heading,"Proyeksi","Realisasi","Selisih","% Realisasi","Status"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r)=><TableRow key={r.name}><TableCell className="font-bold">{r.name}</TableCell><TableCell>{rupiah(r.projected)}</TableCell><TableCell>{rupiah(r.realized)}</TableCell><TableCell>{rupiah(r.difference)}</TableCell><TableCell>{percent(r.realized,r.projected).toFixed(1)}%</TableCell><TableCell><Badge className={statusClass(status(r.projected,r.realized))}>{status(r.projected,r.realized)}</Badge></TableCell></TableRow>)}{!rows.length&&<EmptyRow span={6}/>}</TableBody></Table></CardContent></Card>; }

function CashflowEditor({ page, data, setData, onSave, saving }: { page: CashflowPage; data: CashflowData; setData: (data: CashflowData) => void; onSave: () => void; saving: boolean }) {
  const key = page === "cashflowProjection" ? "projection" : "actual";
  const [modal, setModal] = useState(false); const [entry, setEntry] = useState<CashflowEntry>(emptyEntry); const fileInput = useRef<HTMLInputElement>(null);
  const rows = data[key]; const title = page === "cashflowProjection" ? "Proyeksi" : "Realisasi";
  function submit() { const row = { ...entry, id: entry.id || `cashflow-${crypto.randomUUID()}` }; setData({ ...data, [key]: entry.id ? rows.map((r)=>r.id===entry.id?row:r) : [...rows,row] }); setModal(false); }
  function remove(id: string) { if (!confirm("Hapus data ini?")) return; setData({ ...data, [key]: rows.filter((r)=>r.id!==id) }); }
  async function upload(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!file.name.toLowerCase().endsWith(".xlsx")) { alert("Hanya file Excel .xlsx yang dapat diunggah."); return; } try { const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; if (!sheet) return; const imported = parseCashflowSheet(sheet, page === "cashflowActual"); setData({ ...data, [key]: [...rows, ...imported] }); } catch { alert("File Excel tidak dapat dibaca. Pastikan format file .xlsx valid."); } }
  return <><input ref={fileInput} type="file" accept=".xlsx" onChange={upload} className="hidden"/><Card className="rounded-3xl"><CardContent className="flex flex-wrap justify-between gap-3 p-4"><div><p className="font-black">Cashflow &gt; {title}</p><p className="text-sm text-slate-500">Input dan kelola data {title.toLowerCase()} cashflow.</p></div><div className="flex flex-wrap gap-2"><Button onClick={()=>{setEntry(emptyEntry()); setModal(true)}} className="rounded-xl bg-blue-600"><Plus className="h-4 w-4"/> Tambah Data {title}</Button><Button onClick={()=>fileInput.current?.click()} variant="outline" className="rounded-xl"><FileSpreadsheet className="h-4 w-4"/> Upload Excel</Button><Button onClick={onSave} disabled={saving} variant="outline" className="rounded-xl"><Cloud className="h-4 w-4"/> Save to Cloud</Button></div></CardContent></Card>
  <Card className="overflow-hidden rounded-3xl"><CardContent className="max-h-[68vh] overflow-auto p-0"><Table className="min-w-max"><TableHeader className="sticky top-0 z-10 bg-white"><TableRow>{["No","Brand","Departemen","Item Pembayaran","Deskripsi","Jenis","Nominal","Tanggal","Week",...(page==="cashflowActual"?["Keterangan"]:[]),"Source","Hapus"].map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,index)=><EntryRow key={row.id} index={index} row={row} actual={page==="cashflowActual"} onEdit={()=>{setEntry(row);setModal(true)}} onDelete={()=>remove(row.id)}/>)}{!rows.length&&<EmptyRow span={page==="cashflowActual"?12:11}/>}</TableBody></Table></CardContent></Card>
  {modal&&<EditorModal title={title} entry={entry} setEntry={setEntry} onClose={()=>setModal(false)} onSave={submit}/>}</>;
}

function EntryRow({ row, index, actual, onEdit, onDelete }: { row: CashflowEntry; index:number; actual:boolean; onEdit:()=>void; onDelete:()=>void }) { return <TableRow className="cursor-pointer" onDoubleClick={onEdit}><TableCell>{index+1}</TableCell>{[row.brand,row.department,row.paymentItem,row.description,row.type,rupiah(row.nominal),row.date,row.week,...(actual?[row.notes || "-"]:[]),row.source].map((v,i)=><TableCell key={i}>{v||"-"}</TableCell>)}<TableCell><Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>; }

function EditorModal({ title, entry, setEntry, onClose, onSave }:{title:string;entry:CashflowEntry;setEntry:(v:CashflowEntry)=>void;onClose:()=>void;onSave:()=>void}) { const fields = [["brand","Brand","select",CASHFLOW_BRANDS],["department","Departemen","select",CASHFLOW_DEPARTMENTS],["paymentItem","Item Pembayaran"],["description","Deskripsi"],["type","Jenis","select",CASHFLOW_TYPES],["nominal","Nominal","number"],["date","Tanggal","date"],["week","Week","select",WEEKS],...(title==="Realisasi"?[["notes","Keterangan"]]:[])]; const update=(key:string,next:string)=>setEntry({...entry,[key]:key==="nominal"?safeAmount(next):next}); return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex justify-between border-b bg-white p-5"><h2 className="text-xl font-black">{entry.id?"Edit":"Tambah"} {title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{fields.map(([key,label,type,options])=><label key={key as string} className="space-y-2"><span className="text-sm font-bold">{label as string}</span>{type==="select"?<Select value={String(entry[key as keyof CashflowEntry]??"")} onChange={(e)=>update(key as string,e.target.value)} className="h-11 w-full rounded-xl"><option value="">Pilih {label as string}</option>{(options as readonly string[]).map((o)=><option key={o}>{o}</option>)}</Select>:<Input type={(type as string)||"text"} min={type==="date"?"2026-01-01":undefined} max={type==="date"?"2026-12-31":undefined} value={String(entry[key as keyof CashflowEntry]??"")} onChange={(e)=>update(key as string,e.target.value)} className="h-11 rounded-xl"/>}</label>)}</div><div className="flex justify-end gap-2 border-t p-5"><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={onSave} className="bg-blue-600">Simpan</Button></div></div></div>; }
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
      paymentItem: importedText(normalized["item pembayaran"]),
      description: importedText(normalized.deskripsi),
      type: importedText(normalized.jenis),
      nominal: importedAmount(normalized.nominal),
      date: importedText(normalized.tanggal, "-"),
      week: importedText(normalized.week, "-"),
      source: "Excel Import",
      notes: actual ? importedText(normalized.keterangan) : "",
    };
  });
}
