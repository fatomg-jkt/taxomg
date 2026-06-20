"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Building2, CheckCircle2, Edit3, FileArchive, FileSpreadsheet, Home, Menu, Plus, Receipt, Search, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FILTER_STORAGE_KEY = "tax-dashboard-filters-v1";
const UPLOAD_STORAGE_KEY = "tax-dashboard-upload-records-v1";
const UPLOAD_HISTORY_STORAGE_KEY = "tax-dashboard-upload-history-v1";
const ALL = "__all__";
const TAX_TYPES = ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN", "PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PB1", "PPh UMKM"] as const;
const STATUSES = ["Terverifikasi", "Belum Lengkap", "Nihil", "Lebih Bayar", "Kompensasi", "Sudah ada NTPN/NTPD", "Belum ada NTPN/NTPD", "Nilai pajak 0", "Data kosong"] as const;
const PPH_TYPES: TaxType[] = ["PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PPh UMKM"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type TaxType = (typeof TAX_TYPES)[number];
type Status = (typeof STATUSES)[number];
type Page = "dashboard" | "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm" | "documents";
type ParseResult = { records: TaxTransaction[]; errors: string[]; warnings: string[]; sheetsRead: string[]; skipped: number };

type TaxTransaction = {
  id: string;
  perusahaan: string;
  masaPajak: string;
  tahun: string;
  jenisPajak: TaxType;
  dpp: number;
  pajakTerhutang: number;
  ntpnNtpd: string;
  tanggalBayar?: string;
  status: Status | string;
  statusAuto?: string;
  keterangan: string;
  sourceData?: "Static File" | "Excel Import" | "Manual Input";
  sourceSheet: string;
  sourceRow: number;
  uploadBatchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Filters = { tahun: string; masaPajak: string; perusahaan: string; jenisPajak: string; status: string; search: string };
type UploadBatch = { id: string; file_name: string; uploaded_at: string; total_rows: number; uploaded_by: string; status: string; error_message: string };
type UploadSummary = { filename: string; imported: number; skipped: number; warnings: string[]; errors: string[]; mode: "replace" | "append" } | null;
type StaticTaxEntry = { id?: string; perusahaan?: string; tahun?: string; masaPajak?: string; masa_pajak?: string; jenisPajak?: TaxType; jenis_pajak?: TaxType; dpp?: number | string; pajak?: number | string; pajakTerhutang?: number | string; ntpnNtpd?: string; ntpn_ntpd?: string; tanggalBayar?: string | null; tanggal_bayar?: string | null; status?: string; statusAuto?: string; status_auto?: string; keterangan?: string; sourceData?: "Static File" | "Excel Import" | "Manual Input"; source_data?: "Static File" | "Excel Import" | "Manual Input"; sourceSheet?: string; source_sheet?: string; sourceRow?: number; source_row?: number; uploadBatchId?: string | null; upload_batch_id?: string | null; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string };

type KpiItem = { label: string; value: number; money?: boolean };

const pageMeta: Record<Page, { title: string; subtitle: string; types?: TaxType[] }> = {
  dashboard: { title: "Dashboard", subtitle: "Dashboard utama berisi resume; detail data berada di sidebar jenis pajak." },
  ppn: { title: "PPN", subtitle: "Monitoring PPN keluaran, masukan, PM tidak dikreditkan, dan pembayaran PPN.", types: ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN"] },
  pph21: { title: "PPh Pasal 21", subtitle: "Detail DPP, pajak terhutang, dan kelengkapan NTPN PPh Pasal 21.", types: ["PPh Pasal 21"] },
  unifikasi: { title: "PPh Unifikasi", subtitle: "Gabungan PPh Pasal 23 dan PPh Final 4(2).", types: ["PPh Pasal 23", "PPh Final 4(2)"] },
  pb1: { title: "PB1", subtitle: "Detail PB1 dan status NTPD pembayaran pajak daerah.", types: ["PB1"] },
  umkm: { title: "PPh UMKM", subtitle: "Detail DPP, PPh UMKM, transaksi, dan kelengkapan NTPN.", types: ["PPh UMKM"] },
  documents: { title: "Dokumen Pajak", subtitle: "Daftar dokumen terkait NTPN/NTPD, bukti bayar, PDF, dan file pendukung." },
};

const navItems = [
  ["dashboard", Home, "Dashboard"], ["ppn", Receipt, "PPN"], ["pph21", Receipt, "PPh Pasal 21"], ["unifikasi", Receipt, "PPh Unifikasi"], ["pb1", Building2, "PB1"], ["umkm", Building2, "PPh UMKM"], ["documents", FileArchive, "Dokumen Pajak"],
] as const;

function clean(value: unknown) { return String(value ?? "").trim(); }
function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  const raw = clean(value);
  if (!raw || raw === "-") return 0;
  const text = raw.replace(/\((.*)\)/, "-$1").replace(/[^\d,.-]/g, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  const decimalPos = comma > dot ? comma : dot;
  const fraction = decimalPos >= 0 ? text.slice(decimalPos + 1) : "";
  const normalized = fraction.length > 0 && fraction.length <= 2 ? `${text.slice(0, decimalPos).replace(/[.,]/g, "")}.${fraction.replace(/[.,]/g, "")}` : text.replace(/[.,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizePeriod(value: unknown) {
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return `${MONTHS[d.m - 1]}-${String(d.y).slice(-2)}`;
  }
  const text = clean(value);
  if (!text) return "-";
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${MONTHS[parsed.getMonth()]}-${String(parsed.getFullYear()).slice(-2)}`;
  const match = text.match(/(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*[\s/-]*(\d{2,4})/i);
  if (!match) return text;
  const idx = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"].findIndex((m) => match[1].toLowerCase().startsWith(m) || (m === "mei" && match[1].toLowerCase().startsWith("may")) || (m === "agu" && match[1].toLowerCase().startsWith("aug")) || (m === "okt" && match[1].toLowerCase().startsWith("oct")) || (m === "des" && match[1].toLowerCase().startsWith("dec")));
  return `${MONTHS[Math.max(idx, 0)]}-${match[2].length === 2 ? match[2] : match[2].slice(-2)}`;
}
function periodYear(period: string) { const match = period.match(/(\d{2,4})$/); return match ? (match[1].length === 2 ? `20${match[1]}` : match[1]) : String(new Date().getFullYear()); }
function periodSort(period: string) { const [m] = period.split("-"); return Number(periodYear(period)) * 100 + Math.max(MONTHS.findIndex((month) => month === m), 0); }
function automaticStatus(pajak: number, ntpnNtpd: string, keterangan: string, dppValue?: number): string {
  const text = `${keterangan} ${ntpnNtpd}`.toLowerCase();
  if ((dppValue === undefined || dppValue === 0) && pajak === 0 && !clean(ntpnNtpd) && !clean(keterangan)) return "Data kosong";
  if (/kompensasi|lebih bayar/.test(text)) return "Kompensasi lebih bayar";
  if (pajak < 0) return "Lebih bayar";
  if (pajak === 0) return "Nilai pajak 0";
  return clean(ntpnNtpd) ? "Sudah ada NTPN/NTPD" : "Belum ada NTPN/NTPD";
}
function displayStatus(auto: string): Status | string {
  if (auto === "Sudah ada NTPN/NTPD") return "Terverifikasi";
  if (auto === "Belum ada NTPN/NTPD") return "Belum Lengkap";
  if (auto === "Nilai pajak 0") return "Nihil";
  if (auto === "Lebih bayar") return "Lebih Bayar";
  if (auto === "Kompensasi lebih bayar") return "Kompensasi";
  return auto;
}
type TaxColumnMap = { type: TaxType; dpp: number; pajak: number; ntpn: number };
function cell(row: unknown[], index: number) { return row[index]; }
function makeExcelRecord(params: { sheet: string; rowIndex: number; company: string; masa: unknown; type: TaxType; dpp: unknown; pajak: unknown; ntpn: unknown; keterangan?: unknown }) {
  const pajakTerhutang = numberValue(params.pajak);
  const ntpnNtpd = clean(params.ntpn);
  const dppNumber = numberValue(params.dpp);
  const keterangan = clean(params.keterangan);
  const masaPajak = normalizePeriod(params.masa);
  const statusAuto = automaticStatus(pajakTerhutang, ntpnNtpd, keterangan, dppNumber);
  return { id: `${params.sheet}-${params.rowIndex}-${params.type}-${crypto.randomUUID()}`, perusahaan: clean(params.company), masaPajak, tahun: periodYear(masaPajak), jenisPajak: params.type, dpp: dppNumber, pajakTerhutang, ntpnNtpd, status: displayStatus(statusAuto), statusAuto, keterangan, sourceData: "Excel Import", sourceSheet: params.sheet, sourceRow: params.rowIndex } satisfies TaxTransaction;
}
function validateImportedRecord(record: TaxTransaction) {
  const warnings: string[] = [];
  if (!clean(record.perusahaan)) warnings.push(`Baris ${record.sourceSheet}!${record.sourceRow}: company kosong.`);
  if (!clean(record.masaPajak) || record.masaPajak === "-") warnings.push(`Baris ${record.sourceSheet}!${record.sourceRow}: masa kosong.`);
  if (record.pajakTerhutang <= 0) warnings.push(`Baris ${record.sourceSheet}!${record.sourceRow}: pajak kosong/nol/negatif untuk ${record.jenisPajak}.`);
  if (!clean(record.ntpnNtpd) || clean(record.ntpnNtpd) === "-") warnings.push(`Baris ${record.sourceSheet}!${record.sourceRow}: NTPN/NTPD kosong untuk ${record.jenisPajak}.`);
  return warnings;
}
function hasTaxSignal(row: unknown[], map: TaxColumnMap) { return numberValue(cell(row, map.dpp)) !== 0 || numberValue(cell(row, map.pajak)) !== 0 || clean(cell(row, map.ntpn)); }
function parsePphRows(aoa: unknown[][], sheet: string, startRow: number, companyCol: number, masaCol: number, maps: TaxColumnMap[]) {
  const records: TaxTransaction[] = [];
  let skipped = 0;
  let lastCompany = "";
  aoa.slice(startRow - 1).forEach((row, offset) => {
    const sourceRow = startRow + offset;
    const company = clean(cell(row, companyCol));
    if (company) lastCompany = company;
    const carriedCompany = company || lastCompany;
    const masa = cell(row, masaCol);
    const rowHasData = clean(carriedCompany) || clean(masa) || maps.some((map) => hasTaxSignal(row, map));
    if (!rowHasData) return;
    maps.forEach((map) => {
      if (!hasTaxSignal(row, map)) { skipped += 1; return; }
      records.push(makeExcelRecord({ sheet, rowIndex: sourceRow, company: carriedCompany, masa, type: map.type, dpp: cell(row, map.dpp), pajak: cell(row, map.pajak), ntpn: cell(row, map.ntpn) }));
    });
  });
  return { records, skipped };
}
function parsePpn1001(aoa: unknown[][], sheet: string) {
  const records: TaxTransaction[] = [];
  let skipped = 0;
  const company = clean(cell(aoa[2] ?? [], 1));
  aoa.slice(6, 18).forEach((row, offset) => {
    const sourceRow = 7 + offset;
    const masa = cell(row, 1);
    const maps: TaxColumnMap[] = [
      { type: "PPN Keluaran", dpp: 2, pajak: 3, ntpn: 7 },
      { type: "PPN Masukan", dpp: 4, pajak: 5, ntpn: 7 },
      { type: "Pembayaran PPN", dpp: 6, pajak: 6, ntpn: 7 },
    ];
    if (!clean(masa) && !maps.some((map) => hasTaxSignal(row, map))) return;
    maps.forEach((map) => {
      if (!hasTaxSignal(row, map)) { skipped += 1; return; }
      records.push(makeExcelRecord({ sheet, rowIndex: sourceRow, company, masa, type: map.type, dpp: cell(row, map.dpp), pajak: cell(row, map.pajak), ntpn: cell(row, map.ntpn) }));
    });
  });
  return { records, skipped };
}
function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sheetsRead: string[] = [];
  let skipped = 0;
  const records: TaxTransaction[] = [];
  const read = (sheet: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, blankrows: false, defval: "", raw: false });
  const pphRestoMaps: TaxColumnMap[] = [
    { type: "PPh Pasal 21", dpp: 2, pajak: 3, ntpn: 4 }, { type: "PPh Pasal 23", dpp: 5, pajak: 6, ntpn: 7 }, { type: "PPh Final 4(2)", dpp: 8, pajak: 9, ntpn: 10 }, { type: "PB1", dpp: 11, pajak: 12, ntpn: 13 }, { type: "PPh UMKM", dpp: 14, pajak: 15, ntpn: 16 },
  ];
  const pph1001Maps: TaxColumnMap[] = pphRestoMaps.filter((map) => map.type !== "PB1").map((map) => map.type === "PPh UMKM" ? { ...map, dpp: 11, pajak: 12, ntpn: 13 } : map);
  const obsMaps: TaxColumnMap[] = [
    { type: "PPh Pasal 21", dpp: 3, pajak: 4, ntpn: 5 }, { type: "PPh Pasal 23", dpp: 6, pajak: 7, ntpn: 8 }, { type: "PPh Final 4(2)", dpp: 9, pajak: 10, ntpn: 11 }, { type: "PPh UMKM", dpp: 12, pajak: 13, ntpn: 14 }, { type: "PB1", dpp: 15, pajak: 16, ntpn: 17 },
  ];
  const parsers: Record<string, () => { records: TaxTransaction[]; skipped: number }> = {
    "PPH-Resto": () => parsePphRows(read("PPH-Resto"), "PPH-Resto", 5, 0, 1, pphRestoMaps),
    "PPN-1001": () => parsePpn1001(read("PPN-1001"), "PPN-1001"),
    "PPH-1001": () => parsePphRows(read("PPH-1001"), "PPH-1001", 5, 0, 1, pph1001Maps),
    "PPH-OBS": () => parsePphRows(read("PPH-OBS"), "PPH-OBS", 6, 1, 2, obsMaps),
  };
  Object.entries(parsers).forEach(([sheet, parser]) => {
    if (!wb.SheetNames.includes(sheet)) { warnings.push(`Sheet "${sheet}" tidak ditemukan.`); return; }
    const parsed = parser();
    if (parsed.records.length) sheetsRead.push(sheet); else errors.push(`Sheet "${sheet}" tidak menghasilkan transaksi.`);
    records.push(...parsed.records);
    skipped += parsed.skipped;
  });
  records.forEach((record) => warnings.push(...validateImportedRecord(record)));
  if (!records.length) errors.push("Tidak ada data pajak yang berhasil dinormalisasi dari workbook.");
  return { records, errors, warnings, sheetsRead, skipped };
}
function rupiah(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0); }
function plainNumber(value: number) { return new Intl.NumberFormat("id-ID").format(value || 0); }
function statusTone(status: string) { if (status === "Terverifikasi" || status === "Sudah ada NTPN/NTPD") return "success"; if (status === "Belum Lengkap" || status === "Belum ada NTPN/NTPD" || status === "Data kosong") return "warning"; if (status === "Lebih Bayar" || status === "Kompensasi" || status === "Lebih bayar" || status === "Kompensasi lebih bayar") return "destructive"; return "secondary"; }
function sum(rows: TaxTransaction[], type?: TaxType) { return rows.filter((r) => !type || r.jenisPajak === type).reduce((a, r) => a + r.pajakTerhutang, 0); }
function dpp(rows: TaxTransaction[], types?: TaxType[]) { return rows.filter((r) => !types || types.includes(r.jenisPajak)).reduce((a, r) => a + r.dpp, 0); }

type ManualForm = { id?: string; perusahaan: string; tahun: string; masaPajak: string; jenisPajak: TaxType; dpp: string; pajak: string; ntpnNtpd: string; tanggalBayar: string; status: string; keterangan: string; ppnKeluaran: string; ppnMasukan: string; pmTidakDikreditkan: string; totalPembayaranPpn: string };
const emptyManualForm = (page: Page): ManualForm => ({ id: undefined, perusahaan: "", tahun: String(new Date().getFullYear()), masaPajak: "", jenisPajak: page === "pb1" ? "PB1" : page === "ppn" ? "PPN" : page === "umkm" ? "PPh UMKM" : page === "unifikasi" ? "PPh Pasal 23" : "PPh Pasal 21", dpp: "", pajak: "", ntpnNtpd: "", tanggalBayar: "", status: "", keterangan: "", ppnKeluaran: "", ppnMasukan: "", pmTidakDikreditkan: "", totalPembayaranPpn: "" });
function manualButtonLabel(page: Page) { if (page === "dashboard") return "+ Tambah Data Pajak Manual"; if (page === "ppn") return "+ Tambah Data PPN"; if (page === "pb1") return "+ Tambah Data PB 1"; return "+ Tambah Data PPh"; }
function isManualPage(page: Page) { return page !== "documents"; }
function normalizeManualRecord(form: ManualForm): TaxTransaction {
  const isPpn = form.jenisPajak === "PPN";
  const dppNumber = isPpn ? numberValue(form.ppnKeluaran) : numberValue(form.dpp);
  const computedPpn = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan) + numberValue(form.pmTidakDikreditkan);
  const pajakTerhutang = isPpn ? (clean(form.totalPembayaranPpn) ? numberValue(form.totalPembayaranPpn) : computedPpn) : numberValue(form.pajak);
  const statusAuto = automaticStatus(pajakTerhutang, form.ntpnNtpd, form.keterangan, dppNumber);
  const now = new Date().toISOString();
  return { id: form.id || `manual-${crypto.randomUUID()}`, perusahaan: clean(form.perusahaan), tahun: clean(form.tahun), masaPajak: clean(form.masaPajak), jenisPajak: form.jenisPajak, dpp: dppNumber, pajakTerhutang, ntpnNtpd: clean(form.ntpnNtpd), tanggalBayar: form.tanggalBayar, status: clean(form.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(form.keterangan) || (isPpn ? `PPN Keluaran ${rupiah(numberValue(form.ppnKeluaran))}; PPN Masukan ${rupiah(numberValue(form.ppnMasukan))}; PM Tidak Dikreditkan ${rupiah(numberValue(form.pmTidakDikreditkan))}` : ""), sourceData: "Manual Input", sourceSheet: "Manual Input", sourceRow: 0, createdAt: now, updatedAt: now };
}
function validateManualForm(form: ManualForm) {
  const errors: Record<string, string> = {};
  if (!clean(form.perusahaan)) errors.perusahaan = "Perusahaan wajib diisi.";
  if (!clean(form.tahun)) errors.tahun = "Tahun wajib diisi.";
  if (!clean(form.masaPajak)) errors.masaPajak = "Masa Pajak wajib diisi.";
  if (!clean(form.jenisPajak)) errors.jenisPajak = "Jenis Pajak wajib diisi.";
  const numericFields = form.jenisPajak === "PPN" ? [["ppnKeluaran", form.ppnKeluaran], ["ppnMasukan", form.ppnMasukan], ["pmTidakDikreditkan", form.pmTidakDikreditkan], ["totalPembayaranPpn", form.totalPembayaranPpn]] : [["dpp", form.dpp], ["pajak", form.pajak]];
  numericFields.forEach(([key, value]) => { const raw = clean(value); if (raw && (!/[0-9]/.test(raw) || /[^0-9.,()\-\sRp]/i.test(raw))) errors[key] = "Field harus angka."; });
  return errors;
}
function normalizeStaticEntry(row: StaticTaxEntry, index: number): TaxTransaction {
  const pajak = row.pajak ?? row.pajakTerhutang ?? 0;
  const dppValue = numberValue(row.dpp);
  const pajakValue = numberValue(pajak);
  const ntpnNtpd = clean(row.ntpnNtpd ?? row.ntpn_ntpd);
  const statusAuto = clean(row.statusAuto ?? row.status_auto) || automaticStatus(pajakValue, ntpnNtpd, clean(row.keterangan), dppValue);
  return { id: clean(row.id) || `static-${index + 1}`, perusahaan: clean(row.perusahaan) || "Perusahaan Belum Diisi", tahun: clean(row.tahun) || periodYear(clean(row.masaPajak ?? row.masa_pajak)), masaPajak: clean(row.masaPajak ?? row.masa_pajak) || "-", jenisPajak: (row.jenisPajak ?? row.jenis_pajak ?? "PPh Pasal 21") as TaxType, dpp: dppValue, pajakTerhutang: pajakValue, ntpnNtpd, tanggalBayar: clean(row.tanggalBayar ?? row.tanggal_bayar), status: clean(row.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(row.keterangan), sourceData: row.sourceData ?? row.source_data ?? "Static File", sourceSheet: clean(row.sourceSheet ?? row.source_sheet) || "tax-data.json", sourceRow: Number(row.sourceRow ?? row.source_row) || index + 1, uploadBatchId: row.uploadBatchId ?? row.upload_batch_id, createdAt: clean(row.createdAt ?? row.created_at), updatedAt: clean(row.updatedAt ?? row.updated_at) };
}
function toStaticEntry(row: TaxTransaction) {
  return { id: row.id, perusahaan: row.perusahaan, tahun: row.tahun, masaPajak: row.masaPajak, jenisPajak: row.jenisPajak, dpp: row.dpp, pajak: row.pajakTerhutang, ntpnNtpd: row.ntpnNtpd, tanggalBayar: row.tanggalBayar || "", status: row.status, statusAuto: row.statusAuto || "", keterangan: row.keterangan, sourceData: row.sourceData || "Static File", sourceSheet: row.sourceSheet, createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || new Date().toISOString() };
}
async function loadStaticTaxData() {
  const response = await fetch("/data/tax-data.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload.map(normalizeStaticEntry) : [];
}
async function loadStaticUploadHistory() {
  const response = await fetch("/data/upload-history.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload as UploadBatch[] : [];
}


export function TaxCoordinatorDashboard() {
  const [staticRecords, setStaticRecords] = useState<TaxTransaction[]>([]);
  const [manualRecords, setManualRecords] = useState<TaxTransaction[]>([]);
  const [uploadRecords, setUploadRecords] = useState<TaxTransaction[]>([]);
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ tahun: ALL, masaPajak: ALL, perusahaan: ALL, jenisPajak: ALL, status: ALL, search: "" });
  const [message, setMessage] = useState("Mode file statis aktif. Data utama dibaca dari /public/data/tax-data.json.");
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [uploadSummary, setUploadSummary] = useState<UploadSummary>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyManualForm("dashboard"));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const storageHydrated = useRef(false);
  async function refreshData() {
    setLoading(true); setError(""); setMessage("Memuat data pajak dari file statis...");
    const [taxData, history] = await Promise.all([loadStaticTaxData(), loadStaticUploadHistory()]);
    setStaticRecords(taxData); setUploadBatches((current) => [...current, ...history.filter((item) => !current.some((existing) => existing.id === item.id))]);
    setMessage(taxData.length ? "Mode file statis aktif. Data utama dibaca dari /public/data/tax-data.json." : "Belum ada data. Silakan upload Excel atau update file data statis.");
    setLoading(false);
  }
  useEffect(() => { const saved = localStorage.getItem(FILTER_STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as Partial<Filters>; setFilters({ tahun: parsed.tahun ?? ALL, masaPajak: parsed.masaPajak ?? ALL, perusahaan: parsed.perusahaan ?? ALL, jenisPajak: parsed.jenisPajak ?? ALL, status: parsed.status ?? ALL, search: parsed.search ?? "" }); } const manual = localStorage.getItem("tax-dashboard-manual-records-v1"); if (manual) setManualRecords(JSON.parse(manual).map(normalizeStaticEntry)); const uploaded = localStorage.getItem(UPLOAD_STORAGE_KEY); if (uploaded) setUploadRecords(JSON.parse(uploaded).map(normalizeStaticEntry)); const history = localStorage.getItem(UPLOAD_HISTORY_STORAGE_KEY); if (history) setUploadBatches(JSON.parse(history)); storageHydrated.current = true; refreshData(); }, []);
  useEffect(() => localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters)), [filters]);
  useEffect(() => { if (storageHydrated.current) localStorage.setItem("tax-dashboard-manual-records-v1", JSON.stringify(manualRecords.map(toStaticEntry))); }, [manualRecords]);
  useEffect(() => { if (storageHydrated.current) localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploadRecords.map(toStaticEntry))); }, [uploadRecords]);
  useEffect(() => { if (storageHydrated.current) localStorage.setItem(UPLOAD_HISTORY_STORAGE_KEY, JSON.stringify(uploadBatches)); }, [uploadBatches]);

  const records = useMemo(() => [...staticRecords, ...uploadRecords, ...manualRecords], [staticRecords, uploadRecords, manualRecords]);
  const baseRows = useMemo(() => pageMeta[page].types ? records.filter((r) => pageMeta[page].types?.includes(r.jenisPajak)) : records, [page, records]);
  const filtered = useMemo(() => baseRows.filter((r) => (filters.tahun === ALL || r.tahun === filters.tahun) && (filters.masaPajak === ALL || r.masaPajak === filters.masaPajak) && (filters.perusahaan === ALL || r.perusahaan === filters.perusahaan) && (filters.jenisPajak === ALL || r.jenisPajak === filters.jenisPajak) && (filters.status === ALL || r.status === filters.status) && (!filters.search || `${r.perusahaan} ${r.ntpnNtpd} ${r.jenisPajak} ${r.keterangan}`.toLowerCase().includes(filters.search.toLowerCase()))), [baseRows, filters]);
  const options = (key: keyof TaxTransaction) => Array.from(new Set(records.map((r) => String(r[key] ?? "")))).filter(Boolean).sort((a, b) => key === "masaPajak" ? periodSort(a) - periodSort(b) : a.localeCompare(b));
  const meta = pageMeta[page];

  function updateFilter(key: keyof Filters, value: string) { setFilters((cur) => ({ ...cur, [key]: value })); }
  function openManual(entry?: TaxTransaction) { setFormErrors({}); setForm(entry ? { ...emptyManualForm(page), id: entry.id, perusahaan: entry.perusahaan, tahun: entry.tahun, masaPajak: entry.masaPajak, jenisPajak: entry.jenisPajak, dpp: String(entry.dpp), pajak: String(entry.pajakTerhutang), ntpnNtpd: entry.ntpnNtpd, tanggalBayar: entry.tanggalBayar || "", status: entry.status, keterangan: entry.keterangan, ppnKeluaran: entry.jenisPajak === "PPN" ? String(entry.dpp) : "", ppnMasukan: "", pmTidakDikreditkan: "", totalPembayaranPpn: entry.jenisPajak === "PPN" ? String(entry.pajakTerhutang) : "" } : emptyManualForm(page)); setModalOpen(true); }
  function saveManual() { const errors = validateManualForm(form); setFormErrors(errors); if (Object.keys(errors).length) return; setBusy(true); const next = normalizeManualRecord(form); setManualRecords((rows) => form.id ? rows.map((row) => row.id === form.id ? next : row) : [...rows, next]); setMessage("Data manual tersimpan sementara di browser ini. Export JSON internal tetap menyertakan source data untuk kebutuhan admin."); setModalOpen(false); setBusy(false); }
  function deleteManual(id: string) { if (!confirm("Apakah Anda yakin ingin menghapus data manual sementara ini?")) return; setManualRecords((rows) => rows.filter((row) => row.id !== id)); setMessage("Data manual sementara dihapus dari browser ini."); }
  function deleteBatch(id: string) { if (!confirm("Hapus riwayat dan data upload sementara ini dari browser?")) return; setUploadBatches((rows) => rows.filter((row) => row.id !== id)); setUploadRecords((rows) => rows.filter((row) => row.uploadBatchId !== id)); }
  function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async () => { setBusy(true); setMessage("Memproses Excel..."); setUploadSummary(null); try { const result = parseWorkbook(XLSX.read(reader.result, { type: "array", cellDates: false, cellNF: false, cellText: true })); setError(result.errors.join(" ")); const batchId = `upload-${crypto.randomUUID()}`; const now = new Date().toISOString(); const rows = result.records.map((row) => ({ ...row, id: `${batchId}-${row.id}`, uploadBatchId: batchId, sourceData: "Excel Import" as const, createdAt: now, updatedAt: now })); setUploadRecords((current) => importMode === "append" ? [...current, ...rows] : rows); setUploadBatches((current) => [{ id: batchId, file_name: file.name, uploaded_at: now, total_rows: rows.length, uploaded_by: "browser-localStorage", status: result.errors.length ? "warning" : "success", error_message: [...result.errors, ...result.warnings.slice(0, 8)].join(" ") }, ...(importMode === "append" ? current : [])]); setUploadSummary({ filename: file.name, imported: rows.length, skipped: result.skipped, warnings: result.warnings, errors: result.errors, mode: importMode }); setMessage(`Excel berhasil dinormalisasi dari ${result.sheetsRead.join(", ") || "workbook"} dan disimpan ke localStorage.`); } catch (err) { console.error("[tax-dashboard] Gagal memproses upload Excel", err); const text = err instanceof Error ? err.message : "Data Excel gagal diproses."; setError(text); setUploadSummary({ filename: file.name, imported: 0, skipped: 0, warnings: [], errors: [text], mode: importMode }); } finally { setBusy(false); } };
    reader.readAsArrayBuffer(file); event.target.value = "";
  }

  return <main className="min-h-screen bg-[#EEF3F8] text-slate-950">
    <Sidebar page={page} setPage={setPage} open={drawerOpen} setOpen={setDrawerOpen} />
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 border-b border-[#D8E0EA] bg-[#EEF3F8]/90 px-4 py-3 backdrop-blur lg:hidden"><Button variant="outline" onClick={() => setDrawerOpen(true)}><Menu className="h-4 w-4" /> Menu</Button></header>
      <section className="space-y-6 p-4 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1><p className="mt-2 text-base font-medium text-slate-600">{meta.subtitle}</p></div>{isManualPage(page) && <Button onClick={() => openManual()} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> {manualButtonLabel(page)}</Button>}</div>
        <FilterBar filters={filters} updateFilter={updateFilter} options={{ tahun: options("tahun"), masaPajak: options("masaPajak"), perusahaan: options("perusahaan"), jenisPajak: TAX_TYPES.filter((type) => !meta.types || meta.types.includes(type)), status: STATUSES }} importMode={importMode} setImportMode={setImportMode} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} />
        <Input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
        <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />{loading ? "Memuat data pajak..." : message}{!records.length && !loading && " KPI akan menampilkan 0 sampai data tersedia."}</div>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {uploadSummary && <UploadSummaryCard summary={uploadSummary} />}
        <UploadHistory batches={uploadBatches} onDelete={deleteBatch} />
        {page === "documents" ? <Documents rows={filtered} /> : <><KpiGrid items={buildKpis(page, filtered)} /><DataQuality rows={filtered} /><TransactionTable rows={filtered} title={page === "dashboard" ? "Resume Pembayaran Pajak" : `Tabel detail ${meta.title}`} onEdit={openManual} onDelete={deleteManual} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} /></>}
      </section>
    </div>
    {modalOpen && <ManualModal page={page} form={form} setForm={setForm} errors={formErrors} onClose={() => setModalOpen(false)} onSave={saveManual} saving={busy} />}
  </main>;
}

function Sidebar({ page, setPage, open, setOpen }: { page: Page; setPage: (page: Page) => void; open: boolean; setOpen: (open: boolean) => void }) {
  return <aside className={cn("fixed inset-y-0 left-0 z-40 w-72 transform bg-[#020617] p-5 text-white shadow-2xl transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30"><Receipt className="h-6 w-6" /></div><div><p className="text-lg font-black">Tax Coordinator</p><p className="text-xs font-semibold text-slate-400">Dashboard Perpajakan</p></div></div><Button variant="ghost" size="icon" className="text-white lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button></div>
    <nav className="space-y-2">{navItems.map(([id, Icon, label]) => <button key={id} onClick={() => { setPage(id); setOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition", page === id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5" />{label}</button>)}</nav>
  </aside>;
}
function FilterBar({ filters, updateFilter, options, importMode, setImportMode, onUpload, onManual }: { filters: Filters; updateFilter: (key: keyof Filters, value: string) => void; options: { tahun: string[]; masaPajak: string[]; perusahaan: string[]; jenisPajak: readonly string[]; status: readonly string[] }; importMode: "replace" | "append"; setImportMode: (mode: "replace" | "append") => void; onUpload: () => void; onManual: () => void }) {
  const selects: [keyof Filters, string, readonly string[]][] = [["tahun", "Semua Tahun", options.tahun], ["masaPajak", "Semua Masa Pajak", options.masaPajak], ["perusahaan", "Semua Perusahaan", options.perusahaan], ["jenisPajak", "Semua Jenis Pajak", options.jenisPajak], ["status", "Semua Status", options.status]];
  return <Card className="rounded-3xl border-[#D8E0EA] shadow-sm"><CardContent className="flex flex-wrap items-center gap-3 p-4">{selects.map(([key, placeholder, values]) => <Select key={key} value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)} className="h-11 min-w-0 flex-1 basis-full rounded-2xl bg-white sm:basis-[calc(50%-0.75rem)] lg:basis-44"><option value={ALL}>{placeholder}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}</Select>)}<div className="relative min-w-0 flex-1 basis-full lg:basis-72"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Cari perusahaan, NTPN, jenis pajak..." className="h-11 rounded-2xl bg-white pl-9" /></div><div className="flex w-full flex-wrap items-center gap-3 sm:w-auto"><Select value={importMode} onChange={(e) => setImportMode(e.target.value as "replace" | "append")} className="h-11 rounded-2xl bg-white sm:w-52"><option value="replace">Replace existing data</option><option value="append">Append data</option></Select><Button onClick={onUpload} className="h-11 flex-1 rounded-2xl bg-blue-600 font-bold hover:bg-blue-700 sm:flex-none"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="h-11 flex-1 rounded-2xl font-bold sm:flex-none"><Plus className="h-4 w-4" /> Manual</Button></div></CardContent></Card>;
}
function buildKpis(page: Page, rows: TaxTransaction[]): KpiItem[] {
  if (page === "ppn") return [{ label: "Total PPN Keluaran", value: sum(rows, "PPN Keluaran"), money: true }, { label: "Total PPN Masukan", value: sum(rows, "PPN Masukan"), money: true }, { label: "PM Tidak Dikreditkan", value: sum(rows, "PM Tidak Dikreditkan"), money: true }, { label: "Kurang Bayar/Lebih Bayar", value: sum(rows, "Pembayaran PPN") + sum(rows, "PPN"), money: true }, { label: "Total Pembayaran PPN", value: sum(rows, "Pembayaran PPN") + sum(rows, "PPN"), money: true }];
  if (page === "pph21") return [{ label: "Total DPP PPh 21", value: dpp(rows), money: true }, { label: "Total PPh 21", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "unifikasi") return [{ label: "Total PPh 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total DPP", value: dpp(rows), money: true }, { label: "Total pembayaran", value: sum(rows), money: true }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "pb1") return [{ label: "Total DPP PB1", value: dpp(rows), money: true }, { label: "Total PB1", value: sum(rows), money: true }, { label: "Jumlah NTPD", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPD kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "umkm") return [{ label: "Total DPP UMKM", value: dpp(rows), money: true }, { label: "Total PPh UMKM", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  return [{ label: "Total PPN Keluaran", value: sum(rows, "PPN Keluaran"), money: true }, { label: "Total PPN Masukan", value: sum(rows, "PPN Masukan"), money: true }, { label: "Total PM Tidak Dikreditkan", value: sum(rows, "PM Tidak Dikreditkan"), money: true }, { label: "Total Pembayaran PPN", value: sum(rows, "Pembayaran PPN") + sum(rows, "PPN"), money: true }, { label: "Total PPh Pasal 21", value: sum(rows, "PPh Pasal 21"), money: true }, { label: "Total PPh Pasal 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total PB1", value: sum(rows, "PB1"), money: true }, { label: "Total PPh UMKM", value: sum(rows, "PPh UMKM"), money: true }, { label: "Total seluruh pembayaran pajak", value: sum(rows), money: true }, { label: "Jumlah perusahaan", value: new Set(rows.map((r) => r.perusahaan)).size }, { label: "Jumlah masa pajak", value: new Set(rows.map((r) => r.masaPajak)).size }, { label: "Jumlah NTPN/NTPD terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "Belum memiliki NTPN/NTPD", value: rows.filter((r) => !r.ntpnNtpd).length }];
}
function KpiGrid({ items }: { items: KpiItem[] }) { return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardContent className="p-5"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-3 text-2xl font-black text-slate-950">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p></CardContent></Card>)}</section>; }
function DataQuality({ rows }: { rows: TaxTransaction[] }) {
  const issues = rows.filter((r) => !r.ntpnNtpd || r.pajakTerhutang === 0 || r.pajakTerhutang < 0 || /lebih bayar|kompensasi/i.test(`${r.statusAuto} ${r.keterangan}`) || !r.dpp || !r.masaPajak || !r.perusahaan);
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Data Quality</CardTitle><CardDescription>{issues.length} data perlu review: NTPN/NTPD kosong, pajak 0/negatif, lebih bayar, kompensasi, DPP/masa/perusahaan kosong, atau data belum lengkap.</CardDescription></CardHeader></Card>;
}
function TransactionTable({ title, rows, onEdit, onDelete, onUpload, onManual }: { title: string; rows: TaxTransaction[]; onEdit: (row: TaxTransaction) => void; onDelete: (id: string) => void; onUpload: () => void; onManual: () => void }) { return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{rows.length} baris data.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Perusahaan", "Masa Pajak", "Jenis Pajak", "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Keterangan", "Aksi"].map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((r) => <TableRow key={r.id} className="hover:bg-slate-50"><TableCell className="min-w-56 font-semibold">{r.perusahaan}</TableCell><TableCell>{r.masaPajak}</TableCell><TableCell>{r.jenisPajak}</TableCell><TableCell>{rupiah(r.dpp)}</TableCell><TableCell className={r.pajakTerhutang < 0 ? "font-bold text-red-600" : ""}>{rupiah(r.pajakTerhutang)}</TableCell><TableCell>{r.ntpnNtpd || "-"}</TableCell><TableCell><Badge variant={statusTone(r.status)}>{r.status === "Terverifikasi" && <CheckCircle2 className="mr-1 h-3 w-3" />}{r.status}</Badge><div className="mt-1 text-[11px] font-semibold text-slate-400">{r.statusAuto}</div></TableCell><TableCell><Badge variant={r.sourceData === "Manual Input" ? "success" : "secondary"}>{r.sourceData || "Excel Import"}</Badge></TableCell><TableCell className="min-w-72">{r.keterangan || `${r.sourceSheet} baris ${r.sourceRow}`}</TableCell><TableCell>{r.sourceData === "Manual Input" ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(r)}><Edit3 className="h-3 w-3" /> Edit</Button><Button size="sm" variant="outline" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div> : <Badge variant="secondary">Excel Import</Badge>}</TableCell></TableRow>) : <TableRow><TableCell colSpan={10} className="h-36 text-center text-sm font-semibold text-slate-500"><div className="space-y-4"><p>Belum ada data. Upload Excel atau tambahkan data manual.</p><div className="flex justify-center gap-3"><Button onClick={onUpload} className="rounded-2xl bg-blue-600"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="rounded-2xl"><Plus className="h-4 w-4" /> Tambah Data Manual</Button></div></div></TableCell></TableRow>}</TableBody></Table></CardContent></Card>; }
function ManualModal({ page, form, setForm, errors, onClose, onSave, saving }: { page: Page; form: ManualForm; setForm: (form: ManualForm) => void; errors: Record<string, string>; onClose: () => void; onSave: () => void; saving: boolean }) {
  const set = (key: keyof ManualForm, value: string) => setForm({ ...form, [key]: value });
  const ppnComputed = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan) + numberValue(form.pmTidakDikreditkan);
  const taxOptions = page === "ppn" ? ["PPN"] : page === "pb1" ? ["PB1"] : page === "dashboard" ? ["PPN", ...PPH_TYPES, "PB1"] : PPH_TYPES;
  const field = (key: keyof ManualForm, label: string, type = "text") => <div><label className="text-xs font-extrabold uppercase text-slate-500">{label}</label><Input type={type} value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value)} className="mt-1 h-11 rounded-2xl" />{errors[key] && <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p>}</div>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-black">{form.id ? "Edit Data Pajak Manual" : manualButtonLabel(page)}</h2><p className="text-sm font-medium text-slate-500">Source Data dan Source Sheet otomatis disimpan sebagai Manual Input.</p><p className="mt-2 rounded-2xl bg-blue-50 p-3 text-xs font-semibold text-blue-700">Tanpa database, data manual hanya tersimpan di browser ini. Source Data dan Source Sheet tetap disimpan sebagai informasi internal saat data diekspor oleh admin.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 md:grid-cols-2">{field("perusahaan", "Perusahaan")}{field("tahun", "Tahun")}{field("masaPajak", "Masa Pajak")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Jenis Pajak</label><Select value={form.jenisPajak} onChange={(e) => set("jenisPajak", e.target.value)} className="mt-1 h-11 rounded-2xl">{taxOptions.map((t) => <option key={t} value={t}>{t}</option>)}</Select>{errors.jenisPajak && <p className="mt-1 text-xs font-semibold text-red-600">{errors.jenisPajak}</p>}</div>{form.jenisPajak === "PPN" ? <>{field("ppnKeluaran", "PPN Keluaran")}{field("ppnMasukan", "PPN Masukan")}{field("pmTidakDikreditkan", "PM Tidak Dikreditkan")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Kurang Bayar / Lebih Bayar</label><Input value={rupiah(ppnComputed)} readOnly className="mt-1 h-11 rounded-2xl bg-slate-50" /></div>{field("totalPembayaranPpn", "Total Pembayaran PPN")}</> : <>{field("dpp", form.jenisPajak === "PB1" ? "DPP PB 1" : "DPP")}{field("pajak", form.jenisPajak === "PB1" ? "Nilai PB 1" : "Nilai Pajak / Pajak Terutang")}</>}{field("ntpnNtpd", form.jenisPajak === "PB1" ? "NTPD" : "NTPN/NTPD")}{field("tanggalBayar", "Tanggal Bayar", "date")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Status Manual (opsional)</label><Select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 h-11 rounded-2xl"><option value="">Gunakan status otomatis</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select></div><div className="md:col-span-2">{field("keterangan", "Keterangan")}</div></div><div className="mt-6 flex justify-end gap-3"><Button variant="outline" className="rounded-2xl" onClick={onClose}>Batal</Button><Button className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700" onClick={onSave} disabled={saving}>{saving ? "Menyimpan..." : form.id ? "Simpan Perubahan" : "Simpan"}</Button></div></div></div>;
}

function UploadSummaryCard({ summary }: { summary: NonNullable<UploadSummary> }) {
  const issues = [...summary.errors, ...summary.warnings];
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Upload Summary</CardTitle><CardDescription>{summary.mode === "replace" ? "Replace existing data" : "Append data"} • file tersimpan di localStorage agar tetap ada setelah refresh.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm font-semibold text-slate-700"><p>Filename: <span className="font-black">{summary.filename}</span></p><p>Total records imported: <span className="font-black">{plainNumber(summary.imported)}</span></p><p>Records skipped: <span className="font-black">{plainNumber(summary.skipped)}</span></p><div><p className="font-black">Errors / Warnings:</p>{issues.length ? <ul className="mt-2 max-h-36 list-disc overflow-y-auto pl-5 text-xs text-amber-700">{issues.slice(0, 30).map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}{issues.length > 30 && <li>{issues.length - 30} warning lainnya disembunyikan.</li>}</ul> : <p className="text-xs text-emerald-700">Tidak ada error atau warning validasi.</p>}</div></CardContent></Card>;
}
function UploadHistory({ batches, onDelete }: { batches: UploadBatch[]; onDelete: (id: string) => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Riwayat Upload Excel</CardTitle><CardDescription>{batches.length ? `${batches.length} batch upload dari file statis/sesi browser.` : "Belum ada upload Excel yang tersimpan di file statis."}</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Nama File", "Tanggal Upload", "Jumlah Baris", "Status", "Error", "Aksi"].map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{batches.length ? batches.map((b) => <TableRow key={b.id}><TableCell className="font-semibold">{b.file_name}</TableCell><TableCell>{new Date(b.uploaded_at).toLocaleString("id-ID")}</TableCell><TableCell>{plainNumber(b.total_rows)}</TableCell><TableCell><Badge variant={b.status === "success" ? "success" : "warning"}>{b.status}</Badge></TableCell><TableCell className="max-w-md truncate">{b.error_message || "-"}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => onDelete(b.id)}><Trash2 className="h-3 w-3" /> Hapus Data Upload Ini</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-20 text-center text-sm font-semibold text-slate-500">Belum ada upload Excel yang tersimpan di file statis. Upload di browser akan tampil sementara di sini dan bisa diekspor ke upload-history.json.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}

function Documents({ rows }: { rows: TaxTransaction[] }) { const docs = rows.filter((r) => r.ntpnNtpd || /pdf|bukti|file|dokumen|lampiran/i.test(r.keterangan)); return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Dokumen Pajak</CardTitle><CardDescription>{docs.length} dokumen/rujukan bukti bayar terdeteksi dari data terfilter.</CardDescription></CardHeader><CardContent className="space-y-3">{docs.length ? docs.map((r) => <div key={r.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-950">{r.perusahaan} — {r.jenisPajak}</p><p className="text-sm text-slate-500">{r.masaPajak} • {r.sourceSheet} baris {r.sourceRow} • {r.keterangan || "Bukti bayar / NTPN-NTPD"}</p></div><Badge variant={r.ntpnNtpd ? "success" : "secondary"}>{r.ntpnNtpd || "Dokumen pendukung"}</Badge></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-semibold text-slate-500">Belum ada dokumen pajak. Upload Excel dengan NTPN/NTPD, bukti bayar, PDF, atau file pendukung.</div>}</CardContent></Card>; }
