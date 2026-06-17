"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  CheckSquare,
  Database,
  Download,
  Edit3,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Menu,
  Plus,
  ReceiptText,
  Search,
  StickyNote,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PageType = "Summary" | "Table" | "Notes" | "Checklist" | "Document Storage";
type IconName = "Receipt" | "File" | "Archive" | "Store" | "Building" | "Spreadsheet" | "Chart" | "Notes" | "Checklist" | "Folder";
type TaxStatus = "Terverifikasi" | "Review" | "Jatuh Tempo" | "Butuh Dokumen" | "Terlambat";

type SidebarItem = { id: string; label: string; pageType: PageType; icon: IconName; order: number; active: boolean; system?: boolean };
type TaxRecord = { sidebarId: string; amount: number; status: TaxStatus; period: string; dueDate: string; latestData: string; company: string; updatedAt: string };
type StoredDocument = { id: string; fileName: string; category: string; company: string; period: string; uploadedAt: string; size: number; url: string };

const DB_NAME = "tax-coordinator-storage";
const DOC_STORE = "pdf-documents";
const SIDEBAR_KEY = "tax-coordinator-sidebars";
const DOCUMENT_META_KEY = "tax-coordinator-document-metadata";
const TAX_RECORD_KEY = "tax-coordinator-tax-records";

const periods = ["Semua Masa", "Apr-26", "Mar-26", "Feb-26", "Jan-26"];
const companies = ["Semua Perusahaan", "CV 1001", "PT Nusantara Retail", "PT Garuda Manufacturing", "PT Digital UMKM"];

const iconMap = { Receipt: ReceiptText, File: FileText, Archive: FileArchive, Store, Building: Building2, Spreadsheet: FileSpreadsheet, Chart: BarChart3, Notes: StickyNote, Checklist: CheckSquare, Folder: FolderOpen };
const iconOptions = Object.keys(iconMap) as IconName[];
const pageTypes: PageType[] = ["Summary", "Table", "Notes", "Checklist", "Document Storage"];

const defaultSidebars: SidebarItem[] = [
  { id: "ppn", label: "PPN", pageType: "Summary", icon: "Receipt", order: 1, active: true, system: true },
  { id: "pph-21", label: "PPh Pasal 21", pageType: "Summary", icon: "File", order: 2, active: true, system: true },
  { id: "pph-unifikasi", label: "PPh Unifikasi", pageType: "Summary", icon: "Archive", order: 3, active: true, system: true },
  { id: "pb1", label: "PB1", pageType: "Summary", icon: "Store", order: 4, active: true, system: true },
  { id: "umkm", label: "UMKM", pageType: "Summary", icon: "Building", order: 5, active: true, system: true },
  { id: "dokumen-pajak", label: "Dokumen Pajak", pageType: "Document Storage", icon: "Spreadsheet", order: 6, active: true, system: true },
];

const seedRecords: TaxRecord[] = [
  { sidebarId: "ppn", amount: 71_312_934, status: "Terverifikasi", period: "Apr-26", dueDate: "15 Mei 2026", latestData: "KB/LB Apr-26 Rp -12.584.131", company: "CV 1001", updatedAt: "2026-05-15" },
  { sidebarId: "pph-21", amount: 18_450_000, status: "Review", period: "Apr-26", dueDate: "10 Mei 2026", latestData: "Payroll 128 karyawan", company: "PT Nusantara Retail", updatedAt: "2026-05-10" },
  { sidebarId: "pph-unifikasi", amount: 27_925_500, status: "Jatuh Tempo", period: "Apr-26", dueDate: "20 Mei 2026", latestData: "Bupot vendor selesai 92%", company: "PT Garuda Manufacturing", updatedAt: "2026-05-12" },
  { sidebarId: "pb1", amount: 9_880_000, status: "Butuh Dokumen", period: "Mar-26", dueDate: "15 Apr 2026", latestData: "Rekap outlet belum lengkap", company: "PT Nusantara Retail", updatedAt: "2026-04-15" },
  { sidebarId: "umkm", amount: 5_600_000, status: "Terverifikasi", period: "Apr-26", dueDate: "15 Mei 2026", latestData: "Omzet final 0,5%", company: "PT Digital UMKM", updatedAt: "2026-05-14" },
];

const vatRows = [
  ["CV 1001", "Jan-26", "Rp 46.140.487", "Rp 5.145.628", "Rp 40.994.859", "18E965BMSRJ4L749"],
  ["CV 1001", "Feb-26", "Rp 32.856.012", "Rp 691.878", "Rp 32.164.134", "9A976684GAFNKVEQ"],
  ["CV 1001", "Mar-26", "Rp 24.212.212", "Rp 13.905.419", "Rp 10.306.793", "001403ISSLB147J8"],
  ["CV 1001", "Apr-26", "Rp 0", "Rp 12.584.131", "Rp -12.584.131", "-"],
];

function formatCurrency(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0, notation: Math.abs(value) > 999_999 ? "compact" : "standard" }).format(value); }
function formatBytes(value: number) { return `${(value / 1024 / 1024).toFixed(2)} MB`; }
function safeParse<T>(value: string | null, fallback: T): T { if (!value) return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } }
function statusVariant(status: TaxStatus) { return status === "Terverifikasi" ? "success" : status === "Terlambat" ? "destructive" : status === "Jatuh Tempo" ? "warning" : "secondary"; }

async function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DOC_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function putPdf(id: string, file: File) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const tx = db.transaction(DOC_STORE, "readwrite"); tx.objectStore(DOC_STORE).put(file, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function getPdfUrl(id: string) { const db = await openDb(); return new Promise<string>((resolve, reject) => { const tx = db.transaction(DOC_STORE, "readonly"); const req = tx.objectStore(DOC_STORE).get(id); req.onsuccess = () => resolve(URL.createObjectURL(req.result as Blob)); req.onerror = () => reject(req.error); }); }
async function deletePdf(id: string) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const tx = db.transaction(DOC_STORE, "readwrite"); tx.objectStore(DOC_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }

export function TaxCoordinatorDashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("Semua Masa");
  const [selectedCompany, setSelectedCompany] = useState("Semua Perusahaan");
  const [sidebars, setSidebars] = useState(defaultSidebars);
  const [records, setRecords] = useState(seedRecords);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Semua Kategori");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<SidebarItem>({ id: "", label: "", pageType: "Summary", icon: "Chart", order: 7, active: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSidebars(safeParse(localStorage.getItem(SIDEBAR_KEY), defaultSidebars));
    setDocuments(safeParse(localStorage.getItem(DOCUMENT_META_KEY), []));
    setRecords(safeParse(localStorage.getItem(TAX_RECORD_KEY), seedRecords));
  }, []);
  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebars)); }, [sidebars]);
  useEffect(() => { localStorage.setItem(DOCUMENT_META_KEY, JSON.stringify(documents)); }, [documents]);
  useEffect(() => { localStorage.setItem(TAX_RECORD_KEY, JSON.stringify(records)); }, [records]);

  const activeSidebars = useMemo(() => sidebars.filter((item) => item.active).sort((a, b) => a.order - b.order), [sidebars]);
  const filteredRecords = useMemo(() => records.filter((row) => (selectedPeriod === "Semua Masa" || row.period === selectedPeriod) && (selectedCompany === "Semua Perusahaan" || row.company === selectedCompany)), [records, selectedPeriod, selectedCompany]);
  const filteredDocuments = useMemo(() => documents.filter((doc) => (selectedPeriod === "Semua Masa" || doc.period === selectedPeriod) && (selectedCompany === "Semua Perusahaan" || doc.company === selectedCompany) && (categoryFilter === "Semua Kategori" || doc.category === categoryFilter) && `${doc.fileName} ${doc.category} ${doc.company}`.toLowerCase().includes(search.toLowerCase())), [documents, selectedPeriod, selectedCompany, categoryFilter, search]);
  const categories = ["Semua Kategori", ...Array.from(new Set(documents.map((doc) => doc.category)))];
  const latestDocument = [...documents].sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))[0];
  const topCategory = useMemo(() => documents.reduce((acc, doc) => ({ ...acc, [doc.category]: (acc[doc.category] ?? 0) + 1 }), {} as Record<string, number>), [documents]);
  const topCategoryName = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Belum ada";

  const dashboardRows = activeSidebars.map((item) => {
    const record = filteredRecords.find((row) => row.sidebarId === item.id) ?? records.find((row) => row.sidebarId === item.id);
    if (item.pageType === "Document Storage" || item.id === "dokumen-pajak") return { item, amount: documents.length, status: documents.length ? "Terverifikasi" as TaxStatus : "Butuh Dokumen" as TaxStatus, period: latestDocument?.period ?? "-", dueDate: "Arsip berjalan", latestData: latestDocument?.fileName ?? "Belum ada PDF" };
    return { item, amount: record?.amount ?? 0, status: record?.status ?? "Review" as TaxStatus, period: record?.period ?? "-", dueDate: record?.dueDate ?? "-", latestData: record?.latestData ?? `Sidebar ${item.pageType} siap diisi` };
  });

  function saveSidebar(event: FormEvent) {
    event.preventDefault();
    const id = editingId ?? (draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID());
    const next = { ...draft, id, order: Number(draft.order) || sidebars.length + 1 };
    setSidebars((current) => editingId ? current.map((item) => item.id === editingId ? { ...item, ...next, system: item.system } : item) : [...current, next]);
    if (!editingId && next.pageType !== "Document Storage") setRecords((current) => [...current, { sidebarId: id, amount: 0, status: "Review", period: selectedPeriod === "Semua Masa" ? "Apr-26" : selectedPeriod, dueDate: "Belum diatur", latestData: `Sidebar manual ${next.label} dibuat`, company: selectedCompany === "Semua Perusahaan" ? "CV 1001" : selectedCompany, updatedAt: new Date().toISOString() }]);
    setDraft({ id: "", label: "", pageType: "Summary", icon: "Chart", order: sidebars.length + 2, active: true });
    setEditingId(null);
  }

  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setMessage("File ditolak: hanya PDF yang dapat diupload."); event.target.value = ""; return; }
    const id = crypto.randomUUID();
    await putPdf(id, file);
    setDocuments((current) => [{ id, fileName: file.name, category: "SPT / Bukti Pajak", company: selectedCompany === "Semua Perusahaan" ? "CV 1001" : selectedCompany, period: selectedPeriod === "Semua Masa" ? "Apr-26" : selectedPeriod, uploadedAt: new Date().toISOString(), size: file.size, url: `indexeddb://${DOC_STORE}/${id}` }, ...current]);
    setMessage("PDF berhasil disimpan ke IndexedDB storage browser.");
    event.target.value = "";
  }
  async function previewOrDownload(doc: StoredDocument, download = false) { const url = await getPdfUrl(doc.id); if (download) { const a = document.createElement("a"); a.href = url; a.download = doc.fileName; a.click(); } else window.open(url, "_blank", "noopener,noreferrer"); }
  async function removeDocument(id: string) { await deletePdf(id); setDocuments((current) => current.filter((doc) => doc.id !== id)); }

  const Sidebar = <aside className="flex h-full flex-col bg-slate-950 px-4 py-6 text-white shadow-2xl"><div className="mb-8 flex items-center gap-3 rounded-2xl bg-white/5 p-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30"><ReceiptText className="h-6 w-6" /></div><div><p className="font-black leading-tight">Tax Coordinator</p><p className="text-xs text-slate-400">Dashboard</p></div></div><nav className="space-y-1.5"><button className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white", activeId === "dashboard" && "bg-blue-600 text-white shadow-lg shadow-blue-600/20")} onClick={() => { setActiveId("dashboard"); setMobileOpen(false); }}><BarChart3 className="h-4 w-4" />Dashboard</button>{activeSidebars.map((item) => { const Icon = iconMap[item.icon]; return <button key={item.id} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white", activeId === item.id && "bg-blue-600 text-white shadow-lg shadow-blue-600/20")} onClick={() => { setActiveId(item.id); setMobileOpen(false); }}><Icon className="h-4 w-4" />{item.label}</button>; })}</nav><div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><p className="font-bold text-white">Persistent browser DB</p><p className="mt-1 text-xs leading-5">Sidebar tersimpan di localStorage, PDF di IndexedDB storage.</p></div></aside>;

  return <main className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[280px_1fr]"><div className="hidden lg:block">{Sidebar}</div>{mobileOpen && <div className="fixed inset-0 z-50 grid grid-cols-[280px_1fr] bg-slate-950/50 lg:hidden">{Sidebar}<button aria-label="Tutup sidebar" onClick={() => setMobileOpen(false)} className="p-4 text-white"><X /></button></div>}<section className="min-w-0 p-4 sm:p-6 lg:p-8"><header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-3"><Button variant="outline" size="icon" className="bg-white lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-4 w-4" /></Button><div><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{activeId === "dashboard" ? "Ringkasan Semua Pajak" : sidebars.find((item) => item.id === activeId)?.label}</h1><p className="mt-2 text-sm font-medium text-slate-500">Dashboard merangkum PPN, PPh 21, PPh Unifikasi, PB1, UMKM, dokumen, dan sidebar manual.</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_190px_auto]"><Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="bg-white">{periods.map((period) => <option key={period}>{period}</option>)}</Select><Select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="bg-white">{companies.map((company) => <option key={company}>{company}</option>)}</Select><Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload PDF</Button><Input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={uploadPdf} /></div></header>{message && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{message}</div>}

{activeId === "dashboard" && <><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboardRows.map(({ item, amount, status, period, dueDate, latestData }) => { const Icon = iconMap[item.icon]; return <Card key={item.id} className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Icon className="h-5 w-5" /></div><Badge variant={statusVariant(status)}>{status}</Badge></div><p className="text-sm font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{item.pageType === "Document Storage" ? `${amount} PDF` : formatCurrency(amount)}</p><div className="mt-4 grid gap-2 text-xs font-medium text-slate-500"><span>Masa terbaru: <b className="text-slate-700">{period}</b></span><span>Due date: <b className="text-slate-700">{dueDate}</b></span><span>Data terbaru: <b className="text-slate-700">{latestData}</b></span></div></CardContent></Card>; })}</section><section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]"><Card className="border-slate-200 bg-white"><CardHeader><CardTitle>Resume Pajak Semua Sidebar</CardTitle><CardDescription>Total pajak, masa terbaru, due date, status, dan data terakhir.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow>{["Sidebar", "Total/Count", "Masa", "Due Date", "Status", "Data Terbaru"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{dashboardRows.map((row) => <TableRow key={row.item.id}><TableCell className="font-semibold">{row.item.label}</TableCell><TableCell>{row.item.pageType === "Document Storage" ? `${row.amount} PDF` : formatCurrency(row.amount)}</TableCell><TableCell>{row.period}</TableCell><TableCell>{row.dueDate}</TableCell><TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell><TableCell>{row.latestData}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card className="border-slate-200 bg-white"><CardHeader><CardTitle>Ringkasan Dokumen Pajak</CardTitle><CardDescription>Dashboard membaca metadata PDF dari storage dokumen.</CardDescription></CardHeader><CardContent className="grid gap-4"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Jumlah dokumen PDF</p><p className="text-3xl font-black">{documents.length}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Dokumen terbaru</p><p className="font-bold">{latestDocument?.fileName ?? "Belum ada"}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Kategori terbanyak</p><p className="font-bold">{topCategoryName}</p></div></CardContent></Card></section></>}

{activeId === "dokumen-pajak" && <Card className="border-slate-200 bg-white"><CardHeader><CardTitle>Storage Dokumen PDF</CardTitle><CardDescription>Upload, preview, download, delete, search, dan filter kategori dokumen pajak.</CardDescription></CardHeader><CardContent><div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Cari dokumen..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</Select><Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload PDF</Button></div><Table><TableHeader><TableRow>{["Nama File", "Kategori", "Perusahaan", "Masa", "Tanggal Upload", "Ukuran", "URL", "Aksi"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{filteredDocuments.map((doc) => <TableRow key={doc.id}><TableCell className="font-semibold">{doc.fileName}</TableCell><TableCell>{doc.category}</TableCell><TableCell>{doc.company}</TableCell><TableCell>{doc.period}</TableCell><TableCell>{new Date(doc.uploadedAt).toLocaleString("id-ID")}</TableCell><TableCell>{formatBytes(doc.size)}</TableCell><TableCell className="text-xs text-slate-500">{doc.url}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => previewOrDownload(doc)}><Eye className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => previewOrDownload(doc, true)}><Download className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => removeDocument(doc.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

{activeId !== "dokumen-pajak" && activeId !== "dashboard" && <Card className="border-slate-200 bg-white"><CardHeader><CardTitle>{sidebars.find((item) => item.id === activeId)?.label}</CardTitle><CardDescription>Halaman {sidebars.find((item) => item.id === activeId)?.pageType}; data ini ikut diringkas ke dashboard.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow>{["Perusahaan", "Masa", "PPN Keluaran", "PPN Masukan", "KB/LB", "NTPN"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{vatRows.map((row) => <TableRow key={row[1]}>{row.map((cell, index) => <TableCell key={`${row[1]}-${index}`} className={cn(index === 0 && "font-semibold", index === 4 && "font-semibold")}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>}

<Card className="mt-6 border-slate-200 bg-white"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Sidebar Manual</CardTitle><CardDescription>Tambah, edit, hapus, aktif/nonaktifkan, pilih jenis halaman, icon, dan urutan. Konfigurasi tersimpan permanen di browser database.</CardDescription></CardHeader><CardContent><form onSubmit={saveSidebar} className="mb-5 grid gap-3 md:grid-cols-[1fr_170px_150px_100px_120px]"><Input required placeholder="Nama sidebar" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /><Select value={draft.pageType} onChange={(e) => setDraft({ ...draft, pageType: e.target.value as PageType })}>{pageTypes.map((type) => <option key={type}>{type}</option>)}</Select><Select value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value as IconName })}>{iconOptions.map((icon) => <option key={icon}>{icon}</option>)}</Select><Input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} /><Button type="submit"><Plus className="h-4 w-4" />{editingId ? "Simpan" : "Tambah"}</Button></form><Table><TableHeader><TableRow>{["Urutan", "Nama", "Jenis", "Icon", "Status", "Aksi"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{sidebars.sort((a, b) => a.order - b.order).map((item) => <TableRow key={item.id}><TableCell>{item.order}</TableCell><TableCell className="font-semibold">{item.label}</TableCell><TableCell>{item.pageType}</TableCell><TableCell>{item.icon}</TableCell><TableCell><Badge variant={item.active ? "success" : "secondary"}>{item.active ? "Aktif" : "Nonaktif"}</Badge></TableCell><TableCell><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSidebars((current) => current.map((row) => row.id === item.id ? { ...row, active: !row.active } : row))}>{item.active ? "Nonaktifkan" : "Aktifkan"}</Button><Button size="sm" variant="outline" onClick={() => { setDraft(item); setEditingId(item.id); }}><Edit3 className="h-4 w-4" /></Button><Button size="sm" variant="destructive" disabled={item.system} onClick={() => { setSidebars((current) => current.filter((row) => row.id !== item.id)); setRecords((current) => current.filter((row) => row.sidebarId !== item.id)); }}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></section></main>;
}
