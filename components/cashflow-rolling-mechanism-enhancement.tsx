"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { Cloud, FileDown, FileSpreadsheet, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EMPTY_CASHFLOW, normalizeCashflow, safeAmount, type CashflowData, type CashflowEntry } from "@/lib/cashflow";

const CASHFLOW_PAGES = new Set(["cashflow", "cashflowProjection", "cashflowActual"]);
const BRANDS = ["Obsidian", "1001", "Resto", "Triple Egg", "Wok This Way", "WOK THIS WAY"];
const WEEKS = Array.from({ length: 28 }, (_, index) => `Week ${index + 26}`);
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLocaleLowerCase("id-ID");

function currentPage() { return new URLSearchParams(window.location.search).get("page") || ""; }
function contentShell() { return document.querySelector<HTMLElement>("main > div.min-h-screen"); }
function nativeSection() {
  const shell = contentShell();
  if (!shell) return null;
  return Array.from(shell.children).find((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "SECTION" && !child.hasAttribute("data-cashflow-rolling-host")) ?? null;
}
function weekOf(value: unknown) { const m = clean(value).match(/(\d{1,2})/); return m ? `Week ${m[1]}` : "-"; }
function excelDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") { const p = XLSX.SSF.parse_date_code(value); if (p) return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`; }
  const text = clean(value); if (!text) return ""; const d = new Date(text); return Number.isNaN(d.getTime()) ? text : d.toISOString().slice(0, 10);
}
function amount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = clean(value).replace(/rp/gi, "").replace(/\s/g, "");
  if (!text) return 0;
  const n = Number(/^[+-]?\d{1,3}([.,]\d{3})+$/.test(text) ? text.replace(/[.,]/g, "") : text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function isTransfer(row: CashflowEntry) {
  const text = norm(`${row.type} ${row.description} ${row.notes || ""}`);
  return text.includes("pindah dana") || text.includes("pindah buku") || text.includes("transfer internal") || text.includes("transfer antar");
}
function isCashIn(row: CashflowEntry) { return !isTransfer(row) && safeAmount(row.debit) > 0 && norm(row.department) === "sales"; }
function isCashOut(row: CashflowEntry) { return !isTransfer(row) && safeAmount(row.credit) > 0 && norm(row.department) !== "sales"; }
function isProjectionOut(row: CashflowEntry) { const t = norm(row.type); return !t.includes("revenue") && !t.includes("pindah") && !t.includes("transfer"); }
function statusOf(projection: number, actual: number) {
  if (!projection && !actual) return "BELUM ADA DATA";
  if (!actual) return "BELUM REALISASI";
  if (!projection) return "TIDAK DIPROYEKSI";
  return actual > projection ? "OVER CASHFLOW" : "ON CASHFLOW";
}
function statusClass(value: string) {
  if (value === "OVER CASHFLOW") return "bg-red-100 text-red-700";
  if (value === "ON CASHFLOW") return "bg-emerald-100 text-emerald-700";
  if (value === "TIDAK DIPROYEKSI") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}
function periodForWeek(rows: CashflowEntry[]) {
  const dates = rows.map((r) => new Date(r.date)).filter((d) => !Number.isNaN(d.getTime())).sort((a,b)=>a.getTime()-b.getTime());
  if (!dates.length) return { month: "-", period: "-" };
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const first = dates[0], last = dates[dates.length-1];
  return { month: months[first.getMonth()], period: first.getMonth() === last.getMonth() ? `${first.getDate()}-${last.getDate()} ${months[first.getMonth()]}` : `${first.getDate()} ${months[first.getMonth()]}-${last.getDate()} ${months[last.getMonth()]}` };
}

function projectionRowsFromWorkbook(workbook: XLSX.WorkBook): CashflowEntry[] {
  return workbook.SheetNames.filter((n) => /^PROYEKSI\s+\d{2}-\d{4}$/i.test(n.trim())).flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]; if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: 2, defval: null, raw: true });
    return rows.flatMap((src) => {
      const r = Object.fromEntries(Object.entries(src).map(([k,v]) => [k.trim().toUpperCase(), v]));
      const nominal = amount(r["NOMINAL (RP)"] ?? r.NOMINAL); const description = clean(r.DESKRIPSI);
      if (!clean(r.BRAND) && !description && nominal === 0) return [];
      return [{ id:`projection-${crypto.randomUUID()}`, brand:clean(r.BRAND)||"-", department:clean(r.DEPARTEMEN)||"-", paymentItem:clean(r["ITEM PEMBAYARAN"]), description, type:clean(r.JENIS)||"Fix Cost", nominal, date:excelDate(r.TANGGAL), week:weekOf(r.WEEK), source:`Excel Workbook · ${sheetName}`, notes:"", debit:0, credit:0 } satisfies CashflowEntry];
    });
  });
}
function actualRowsFromWorkbook(workbook: XLSX.WorkBook): CashflowEntry[] {
  const sheetName = workbook.SheetNames.find((n) => n.trim().toUpperCase() === "REALISASI"); if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName]; if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval:null, raw:true });
  return rows.flatMap((src) => {
    const r = Object.fromEntries(Object.entries(src).map(([k,v]) => [k.trim().toUpperCase(), v]));
    const debit = amount(r.DEBIT), credit = amount(r.KREDIT), department = clean(r.DEPARTEMEN), finance = clean(r["KETERANGAN FINANCE"]), bankDesc = clean(r["KETERANGAN BANK"]);
    if (!clean(r.BRAND) && !finance && !bankDesc && !debit && !credit) return [];
    const transfer = norm(`${finance} ${bankDesc}`).includes("pindah dana") || norm(`${finance} ${bankDesc}`).includes("pindah buku");
    const type = transfer ? "Pindah Dana" : debit > 0 && norm(department) === "sales" ? "Revenue" : credit > 0 ? "Cash Out" : "Realisasi";
    return [{ id:`actual-${crypto.randomUUID()}`, brand:clean(r.BRAND)||"-", bank:clean(r["BANK/KAS"]), company:clean(r.PERUSAHAAN), department:department||"-", paymentItem:finance, description:finance||bankDesc, type, nominal:type==="Revenue"?debit:type==="Cash Out"?credit:Math.max(debit,credit), date:excelDate(r.DATE), week:weekOf(r.WEEK), source:`Excel Workbook · ${sheetName}`, notes:bankDesc, debit, credit } satisfies CashflowEntry];
  });
}
function openingBalanceFromWorkbook(workbook: XLSX.WorkBook) {
  const name = workbook.SheetNames.find((n) => /rolling|roling/i.test(n) && /cashflow/i.test(n));
  if (!name) return 0; const sheet = workbook.Sheets[name]; return sheet ? amount(sheet.B4?.v) : 0;
}

function exportExcel(rows: CashflowEntry[], actual: boolean) {
  const data = actual ? rows.map((r) => ({ Brand:r.brand, "Bank/Kas":r.bank||"", Perusahaan:r.company||"", Date:r.date, "Keterangan Finance":r.description, Departemen:r.department, "Keterangan Bank":r.notes||"", Debit:safeAmount(r.debit), Kredit:safeAmount(r.credit), Week:r.week })) : rows.map((r) => ({ Brand:r.brand, Departemen:r.department, "Item Pembayaran":r.paymentItem, Deskripsi:r.description, Jenis:r.type, Nominal:r.nominal, Tanggal:r.date, Week:r.week }));
  const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, actual ? "REALISASI" : "PROYEKSI"); XLSX.writeFile(wb, `cashflow-${actual?"realisasi":"proyeksi"}-${new Date().toISOString().slice(0,10)}.xlsx`);
}
function exportPdf(rows: CashflowEntry[], actual: boolean) {
  const w = window.open("", "_blank", "width=1200,height=800"); if (!w) return;
  const headers = actual ? ["Brand","Bank/Kas","Perusahaan","Date","Keterangan Finance","Departemen","Keterangan Bank","Debit","Kredit","Week"] : ["Brand","Departemen","Item Pembayaran","Deskripsi","Jenis","Nominal","Tanggal","Week"];
  const body = rows.map((r) => actual ? [r.brand,r.bank||"",r.company||"",r.date,r.description,r.department,r.notes||"",rupiah(safeAmount(r.debit)),rupiah(safeAmount(r.credit)),r.week] : [r.brand,r.department,r.paymentItem,r.description,r.type,rupiah(r.nominal),r.date,r.week]);
  w.document.write(`<html><head><title>Cashflow</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif}h1{font-family:Georgia,serif}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #ddd;padding:5px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Cashflow ${actual?"Realisasi":"Proyeksi"}</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(v=>`<td>${String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`); w.document.close(); setTimeout(()=>w.print(),250);
}

function CashflowRollingDashboard({ data, setData, save, saving, importWorkbook }: { data:CashflowData; setData:(d:CashflowData)=>void; save:()=>void; saving:boolean; importWorkbook:(e:ChangeEvent<HTMLInputElement>)=>void }) {
  const input = useRef<HTMLInputElement>(null);
  const weeks = useMemo(() => Array.from(new Set([...data.projection.map(r=>weekOf(r.week)),...data.actual.map(r=>weekOf(r.week))])).filter(w=>w!=="-").sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0])), [data]);
  const rolling = useMemo(() => { let opening = safeAmount(data.openingBalance); return weeks.map((week) => { const p=data.projection.filter(r=>weekOf(r.week)===week), a=data.actual.filter(r=>weekOf(r.week)===week), projection=p.filter(isProjectionOut).reduce((s,r)=>s+r.nominal,0), cashIn=a.filter(isCashIn).reduce((s,r)=>s+safeAmount(r.debit),0), actual=a.filter(isCashOut).reduce((s,r)=>s+safeAmount(r.credit),0), difference=projection-actual, realization=projection?actual/projection*100:actual?-1:0, status=statusOf(projection,actual), effectiveOut=actual>0?actual:projection, net=cashIn-effectiveOut, closing=opening+net, period=periodForWeek([...p,...a]); const row={week,...period,opening,cashIn,projection,actual,difference,realization,status,net,closing}; opening=closing; return row; }); }, [data,weeks]);
  const totalProjection = data.projection.filter(isProjectionOut).reduce((s,r)=>s+r.nominal,0), totalActual=data.actual.filter(isCashOut).reduce((s,r)=>s+safeAmount(r.credit),0), totalIn=data.actual.filter(isCashIn).reduce((s,r)=>s+safeAmount(r.debit),0);
  return <section className="space-y-6 p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black sm:text-4xl">Cashflow</h1><p className="mt-2 text-slate-600">Mekanisme mengikuti Rolling Cashflow: Debit = uang masuk, Kredit = uang keluar, dan Pindah Dana/Pindah Buku tidak dihitung sebagai arus kas operasional.</p></div><div className="flex flex-wrap gap-2"><input ref={input} type="file" accept=".xlsx" onChange={importWorkbook} className="hidden"/><Button variant="outline" onClick={()=>input.current?.click()}><FileSpreadsheet className="h-4 w-4"/> Upload Workbook Excel</Button><Button variant="outline" onClick={save} disabled={saving}><Cloud className="h-4 w-4"/> {saving?"Menyimpan...":"Save to Cloud"}</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-5"><p className="text-xs font-bold text-slate-500">SALDO AWAL</p><Input type="number" value={String(data.openingBalance||0)} onChange={e=>setData({...data,openingBalance:safeAmount(e.target.value)})} className="mt-3"/></CardContent></Card><Kpi label="TOTAL PROYEKSI OUT" value={totalProjection}/><Kpi label="TOTAL REALISASI OUT / KREDIT" value={totalActual}/><Kpi label="TOTAL CASH IN / DEBIT SALES" value={totalIn}/></div>
    <Card><CardHeader><CardTitle>Rolling Cashflow per Week</CardTitle><CardDescription>Saldo akhir minggu menjadi saldo awal minggu berikutnya. Bila realisasi cash out belum ada, proyeksi dipakai untuk perhitungan net cashflow, sama seperti workbook.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Week","Bulan","Periode","Saldo Awal","Realisasi Cash In (Debit)","Proyeksi Cash Out","Realisasi Cash Out (Kredit)","Sisa / Over","% Realisasi","Status","Net Cashflow","Saldo Akhir"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rolling.map(r=><TableRow key={r.week}><TableCell className="font-bold">{r.week}</TableCell><TableCell>{r.month}</TableCell><TableCell>{r.period}</TableCell><TableCell>{rupiah(r.opening)}</TableCell><TableCell>{rupiah(r.cashIn)}</TableCell><TableCell>{rupiah(r.projection)}</TableCell><TableCell>{rupiah(r.actual)}</TableCell><TableCell className={r.difference<0?"text-red-600":"text-emerald-700"}>{rupiah(r.difference)}</TableCell><TableCell>{r.realization<0?"-":`${r.realization.toFixed(1)}%`}</TableCell><TableCell><Badge className={statusClass(r.status)}>{r.status}</Badge></TableCell><TableCell className={r.net<0?"text-red-600":"text-blue-700"}>{rupiah(r.net)}</TableCell><TableCell className="font-bold">{rupiah(r.closing)}</TableCell></TableRow>)}{!rolling.length&&<Empty span={12}/>}</TableBody></Table></CardContent></Card>
  </section>;
}
function Kpi({label,value}:{label:string;value:number}) { return <Card><CardContent className="p-5"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-3 text-xl font-black">{rupiah(value)}</p></CardContent></Card>; }
function Empty({span}:{span:number}) { return <TableRow><TableCell colSpan={span} className="h-24 text-center text-slate-500">Belum ada data.</TableCell></TableRow>; }

function CashflowEditor({ actual, data, setData, save, saving }: { actual:boolean; data:CashflowData; setData:(d:CashflowData)=>void; save:()=>void; saving:boolean }) {
  const key = actual ? "actual" : "projection"; const rows=data[key]; const [modal,setModal]=useState(false); const [entry,setEntry]=useState<CashflowEntry>({id:"",brand:"",department:"",paymentItem:"",description:"",type:actual?"Realisasi":"Fix Cost",nominal:0,date:"",week:"",source:"Manual Input",notes:"",bank:"",company:"",debit:0,credit:0});
  const blank=()=>({id:"",brand:"",department:"",paymentItem:"",description:"",type:actual?"Realisasi":"Fix Cost",nominal:0,date:"",week:"",source:"Manual Input",notes:"",bank:"",company:"",debit:0,credit:0} as CashflowEntry);
  const saveEntry=()=>{ const next={...entry,id:entry.id||`cashflow-${crypto.randomUUID()}`,nominal:actual?(safeAmount(entry.debit)>0?safeAmount(entry.debit):safeAmount(entry.credit)):safeAmount(entry.nominal)}; setData({...data,[key]:entry.id?rows.map(r=>r.id===entry.id?next:r):[...rows,next]}); setModal(false); };
  const remove=(id:string)=>{if(confirm("Hapus data ini?"))setData({...data,[key]:rows.filter(r=>r.id!==id)});};
  return <section className="space-y-5 p-4 sm:p-6 xl:p-8"><Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h1 className="text-2xl font-black">Cashflow &gt; {actual?"Realisasi":"Proyeksi"}</h1><p className="text-sm text-slate-500">{actual?"Debit untuk uang masuk dan Kredit untuk uang keluar, mengikuti sheet REALISASI.":"Struktur input mengikuti sheet PROYEKSI."}</p></div><div className="flex flex-wrap gap-2"><Button onClick={()=>{setEntry(blank());setModal(true)}}><Plus className="h-4 w-4"/> Tambah Data</Button><Button variant="outline" onClick={()=>exportExcel(rows,actual)}><FileSpreadsheet className="h-4 w-4"/> Export Excel</Button><Button variant="outline" onClick={()=>exportPdf(rows,actual)}><FileDown className="h-4 w-4"/> Export PDF</Button><Button variant="outline" onClick={save} disabled={saving}><Cloud className="h-4 w-4"/> Save to Cloud</Button></div></CardContent></Card>
    <Card className="overflow-hidden"><CardContent className="max-h-[70vh] overflow-auto p-0"><Table className="min-w-max"><TableHeader className="sticky top-0 bg-white"><TableRow>{(actual?["No","Brand","Bank/Kas","Perusahaan","Date","Keterangan Finance","Departemen","Keterangan Bank","Debit","Kredit","Week","Aksi"]:["No","Brand","Departemen","Item Pembayaran","Deskripsi","Jenis","Nominal","Tanggal","Week","Aksi"]).map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r,i)=><TableRow key={r.id} onDoubleClick={()=>{setEntry(r);setModal(true)}}>{actual?<><TableCell>{i+1}</TableCell><TableCell>{r.brand}</TableCell><TableCell>{r.bank||"-"}</TableCell><TableCell>{r.company||"-"}</TableCell><TableCell>{r.date}</TableCell><TableCell className="max-w-72 whitespace-normal">{r.description||"-"}</TableCell><TableCell>{r.department}</TableCell><TableCell className="max-w-80 whitespace-normal">{r.notes||"-"}</TableCell><TableCell className="font-bold text-emerald-700">{rupiah(safeAmount(r.debit))}</TableCell><TableCell className="font-bold text-red-600">{rupiah(safeAmount(r.credit))}</TableCell><TableCell>{r.week}</TableCell></>:<><TableCell>{i+1}</TableCell><TableCell>{r.brand}</TableCell><TableCell>{r.department}</TableCell><TableCell>{r.paymentItem}</TableCell><TableCell>{r.description}</TableCell><TableCell>{r.type}</TableCell><TableCell>{rupiah(r.nominal)}</TableCell><TableCell>{r.date}</TableCell><TableCell>{r.week}</TableCell></>}<TableCell><Button size="sm" variant="ghost" onClick={()=>remove(r.id)} className="text-red-600"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}{!rows.length&&<Empty span={actual?12:10}/>}</TableBody></Table></CardContent></Card>
    {modal&&<EditorModal actual={actual} entry={entry} setEntry={setEntry} close={()=>setModal(false)} save={saveEntry}/>}</section>;
}
function EditorModal({actual,entry,setEntry,close,save}:{actual:boolean;entry:CashflowEntry;setEntry:(e:CashflowEntry)=>void;close:()=>void;save:()=>void}) {
  const update=(key:keyof CashflowEntry,value:string)=>setEntry({...entry,[key]:["nominal","debit","credit"].includes(key as string)?safeAmount(value):value});
  const fields = actual ? [["brand","Brand"],["bank","Bank/Kas"],["company","Perusahaan"],["date","Date","date"],["description","Keterangan Finance"],["department","Departemen"],["notes","Keterangan Bank"],["debit","Debit","number"],["credit","Kredit","number"],["week","Week","select"]] : [["brand","Brand"],["department","Departemen"],["paymentItem","Item Pembayaran"],["description","Deskripsi"],["type","Jenis"],["nominal","Nominal","number"],["date","Tanggal","date"],["week","Week","select"]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white"><div className="flex justify-between border-b p-5"><h2 className="text-xl font-black">{entry.id?"Edit":"Tambah"} {actual?"Realisasi":"Proyeksi"}</h2><Button variant="ghost" size="icon" onClick={close}><X/></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{fields.map(([key,label,type])=><label key={key} className="space-y-2"><span className="text-sm font-bold">{label}</span>{type==="select"?<Select value={String(entry[key as keyof CashflowEntry]??"")} onChange={e=>update(key as keyof CashflowEntry,e.target.value)}><option value="">Pilih Week</option>{WEEKS.map(w=><option key={w}>{w}</option>)}</Select>:key==="brand"?<Select value={entry.brand} onChange={e=>update("brand",e.target.value)}><option value="">Pilih Brand</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</Select>:<Input type={type||"text"} value={String(entry[key as keyof CashflowEntry]??"")} onChange={e=>update(key as keyof CashflowEntry,e.target.value)}/>}</label>)}</div><div className="flex justify-end gap-2 border-t p-5"><Button variant="outline" onClick={close}>Batal</Button><Button onClick={save}>Simpan</Button></div></div></div>;
}

function CashflowRollingApp({ page }: { page:string }) {
  const [data,setData]=useState<CashflowData>(EMPTY_CASHFLOW), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false), [notice,setNotice]=useState("");
  useEffect(()=>{fetch("/api/cashflow-data",{cache:"no-store"}).then(r=>r.json()).then(p=>setData(normalizeCashflow(p.cashflowData))).finally(()=>setLoading(false));},[]);
  async function save(){const password=window.prompt("Masukkan password edit");if(!password)return;setSaving(true);try{const r=await fetch("/api/cashflow-data",{method:"POST",headers:{"Content-Type":"application/json","x-dashboard-password":password},body:JSON.stringify({cashflowData:data})});if(!r.ok)throw new Error("Save to Cloud gagal.");setNotice("Cashflow berhasil disimpan ke cloud.");}catch(e){alert(e instanceof Error?e.message:"Save gagal");}finally{setSaving(false);}}
  async function importWorkbook(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!confirm("Import workbook akan mengganti data Proyeksi dan Realisasi Cashflow aktif. Lanjutkan?"))return;try{const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});const projection=projectionRowsFromWorkbook(wb),actual=actualRowsFromWorkbook(wb),openingBalance=openingBalanceFromWorkbook(wb);if(!projection.length||!actual.length)throw new Error("Sheet PROYEKSI atau REALISASI tidak ditemukan.");setData(current=>({...current,projection,actual,openingBalance:openingBalance||current.openingBalance}));setNotice(`Workbook berhasil dibaca: ${projection.length} Proyeksi, ${actual.length} Realisasi. Debit/Kredit dan Saldo Awal ikut diproses. Klik Save to Cloud untuk menyimpan.`);}catch(err){alert(err instanceof Error?err.message:"Workbook gagal dibaca.");}}
  if(loading)return <section className="p-8 text-center text-slate-500">Memuat Cashflow...</section>;
  return <>{notice&&<div className="mx-4 mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800 sm:mx-6 xl:mx-8">{notice}</div>}{page==="cashflow"?<CashflowRollingDashboard data={data} setData={setData} save={save} saving={saving} importWorkbook={importWorkbook}/>:<CashflowEditor actual={page==="cashflowActual"} data={data} setData={setData} save={save} saving={saving}/>}</>;
}

export function CashflowRollingMechanismEnhancement(){const [host,setHost]=useState<HTMLElement|null>(null),[page,setPage]=useState("");useEffect(()=>{let timer=0;const sync=()=>{const shell=contentShell(),section=nativeSection(),next=currentPage(),active=CASHFLOW_PAGES.has(next);setPage(next);if(!shell||!section){setHost(null);return;}let h=shell.querySelector<HTMLElement>(":scope > [data-cashflow-rolling-host]");if(!h){h=document.createElement("div");h.dataset.cashflowRollingHost="true";shell.appendChild(h);}setHost(h);section.style.display=active?"none":"";h.style.display=active?"block":"none";};sync();timer=window.setInterval(sync,300);window.addEventListener("popstate",sync);return()=>{window.clearInterval(timer);window.removeEventListener("popstate",sync);const section=nativeSection();if(section)section.style.display="";};},[]);if(!host||!CASHFLOW_PAGES.has(page))return null;return createPortal(<CashflowRollingApp page={page}/>,host);}
