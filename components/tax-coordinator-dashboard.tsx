"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parseTaxWorkbook, type TaxRecord } from "@/src/lib/parseTaxWorkbook";
import { Building2, CheckCircle2, Download, Edit3, Eye, FileArchive, FileSpreadsheet, Home, Menu, Plus, Receipt, Search, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FILTER_STORAGE_KEY = "tax-dashboard-filters-v1";
const DEFAULT_DASHBOARD_YEAR = "2026";
const ALL = "__all__";
const TAX_TYPES = ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN", "PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PB1", "PPh UMKM"] as const;
const STATUSES = ["Terverifikasi", "Belum Lengkap", "Nihil", "Lebih Bayar", "Kompensasi", "Sudah ada NTPN/NTPD", "Belum ada NTPN/NTPD", "Nilai pajak 0", "Data kosong"] as const;
const PPH_TYPES: TaxType[] = ["PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PPh UMKM"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;

type TaxType = (typeof TAX_TYPES)[number];
type Status = (typeof STATUSES)[number];
type Page = "dashboard" | "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm" | "documents";
type ParseResult = { records: TaxTransaction[]; errors: string[]; sheetsRead: string[] };

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
  ppnKeluaran?: number;
  ppnMasukan?: number;
  pmTidakDikreditkan?: number;
  uploadBatchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Filters = { tahun: string; masaPajak: string; perusahaan: string; jenisPajak: string; status: string; search: string };
type UploadBatch = { id: string; file_name: string; uploaded_at: string; total_rows: number; uploaded_by: string; status: string; error_message: string };
type UploadedPdfDocument = { id: string; name: string; uploadedAt: string | null; size: number; type?: string; url: string };
type StaticTaxEntry = { id?: string; perusahaan?: string; tahun?: string; masaPajak?: string; masa_pajak?: string; jenisPajak?: TaxType; jenis_pajak?: TaxType; dpp?: number | string; pajak?: number | string; pajakTerhutang?: number | string; ntpnNtpd?: string; ntpn_ntpd?: string; tanggalBayar?: string | null; tanggal_bayar?: string | null; ppnKeluaran?: number | string; ppn_keluaran?: number | string; ppnMasukan?: number | string; ppn_masukan?: number | string; pmTidakDikreditkan?: number | string; pm_tidak_dikreditkan?: number | string; status?: string; statusAuto?: string; status_auto?: string; keterangan?: string; sourceData?: "Static File" | "Excel Import" | "Manual Input"; source_data?: "Static File" | "Excel Import" | "Manual Input"; sourceSheet?: string; source_sheet?: string; sourceRow?: number; source_row?: number; uploadBatchId?: string | null; upload_batch_id?: string | null; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string };

type SummaryOverrides = Record<string, number>;
type KpiItem = { label: string; value: number; money?: boolean };

const pageMeta: Record<Page, { title: string; subtitle: string; types?: TaxType[] }> = {
  dashboard: { title: "Dashboard Tax All Group", subtitle: "" },
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

function monthIndex(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text) return -1;
  return MONTH_NAMES.findIndex((month, index) => text === month.toLowerCase() || text.startsWith(month.toLowerCase().slice(0, 3)) || text.startsWith(MONTHS[index].toLowerCase()));
}
function normalizePaymentDate(value: unknown) {
  const text = clean(value);
  if (!text) return "";
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const [, first, second, rawYear] = slash;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${first.padStart(2, "0")}/${second.padStart(2, "0")}/${year}`;
  }
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
  return text;
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
function periodSort(period: string) { const [m] = period.split("-"); const idx = monthIndex(m); return Number(periodYear(period)) * 100 + (idx >= 0 ? idx : 0); }
function taxTypeFromText(value: unknown, sheet = ""): TaxType | undefined {
  const text = `${value ?? ""} ${sheet}`.toLowerCase();
  if (/pm\s*tidak|tidak\s+dikredit/.test(text)) return "PM Tidak Dikreditkan";
  if (/pembayaran\s*ppn|bayar\s*ppn|kurang\s*bayar|lebih\s*bayar|kb\/?lb/.test(text)) return "Pembayaran PPN";
  if (/ppn.*masukan|masukan.*ppn|input\s*vat/.test(text)) return "PPN Masukan";
  if (/ppn|vat|keluaran|output\s*vat/.test(text)) return "PPN Keluaran";
  if (/pb\s*1|pb1|resto|restaurant|restoran/.test(text)) return "PB1";
  if (/umkm/.test(text)) return "PPh UMKM";
  if (/4\s*\(?2\)?|final/.test(text)) return "PPh Final 4(2)";
  if (/23/.test(text)) return "PPh Pasal 23";
  if (/21/.test(text)) return "PPh Pasal 21";
  return undefined;
}
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
function hasSignal(row: unknown[]) { return row.some((cell) => clean(cell)) && (row.some((cell) => numberValue(cell) !== 0) || row.some((cell) => /ntpn|ntpd|kompensasi|lebih bayar|pph|ppn|pb\s*1/i.test(clean(cell)))); }
function rowToRecords(row: unknown[], sheet: string, idx: number, headers?: string[]) {
  const lower = (headers ?? []).map((h) => h.toLowerCase());
  const at = (...keys: string[]) => lower.findIndex((h) => keys.some((k) => h.includes(k)));
  const perusahaanIdx = at("perusahaan", "company", "nama perusahaan");
  const masaIdx = at("masa", "periode", "bulan", "period");
  const jenisIdx = at("jenis", "tax type", "kategori");
  const dppIdx = at("dpp", "dasar");
  const pajakIdx = at("pajak terhutang", "nilai pajak", "jumlah pajak", "amount", "pembayaran", "ppn");
  const ntpnIdx = at("ntpn", "ntpd", "bukti");
  const ketIdx = at("keterangan", "catatan", "note", "remark");
  const perusahaan = clean(row[perusahaanIdx >= 0 ? perusahaanIdx : 0]) || "Perusahaan Belum Diisi";
  const masaPajak = normalizePeriod(row[masaIdx >= 0 ? masaIdx : 1]);
  const keterangan = clean(row[ketIdx >= 0 ? ketIdx : row.length - 1]);
  const makeRecord = (jenisPajak: TaxType, dpp: unknown, pajak: unknown, ntpn: unknown) => {
    const pajakTerhutang = numberValue(pajak);
    const ntpnNtpd = clean(ntpn);
    const dppNumber = numberValue(dpp); const statusAuto = automaticStatus(pajakTerhutang, ntpnNtpd, keterangan, dppNumber);
    return { id: `${sheet}-${idx}-${jenisPajak}-${crypto.randomUUID()}`, perusahaan, masaPajak, tahun: periodYear(masaPajak), jenisPajak, dpp: dppNumber, pajakTerhutang, ntpnNtpd, status: displayStatus(statusAuto), statusAuto, keterangan, sourceData: "Excel Import", sourceSheet: sheet, sourceRow: idx + 1 } satisfies TaxTransaction;
  };
  if (headers && perusahaanIdx >= 0) return [makeRecord(taxTypeFromText(row[jenisIdx], sheet) ?? taxTypeFromText(row.join(" "), sheet) ?? "PPh Pasal 21", row[dppIdx], row[pajakIdx], row[ntpnIdx])];
  return [makeRecord("PPh Pasal 21", row[2], row[3], row[4]), makeRecord("PPh Pasal 23", row[5], row[6], row[7]), makeRecord("PPh Final 4(2)", row[8], row[9], row[10]), makeRecord("PB1", row[11], row[12], row[13]), makeRecord("PPh UMKM", row[14], row[15], row[16])].filter((r) => r.dpp || r.pajakTerhutang || r.ntpnNtpd || r.keterangan);
}
function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const errors: string[] = [];
  const sheetsRead: string[] = [];
  const records = wb.SheetNames.flatMap((sheet) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, blankrows: false });
    const headerRow = aoa.findIndex((row) => row.some((cell) => /perusahaan|company|masa|jenis pajak|dpp|ntpn|ntpd/i.test(clean(cell))));
    const headers = headerRow >= 0 ? aoa[headerRow].map(clean) : undefined;
    const parsed = aoa.slice(headerRow >= 0 ? headerRow + 1 : 1).filter(hasSignal).flatMap((row, i) => rowToRecords(row, sheet, i + (headerRow >= 0 ? headerRow + 1 : 1), headers));
    if (parsed.length) sheetsRead.push(sheet); else errors.push(`Sheet "${sheet}" tidak menghasilkan transaksi. Pastikan kolom Perusahaan, Masa Pajak, Jenis Pajak, DPP, Pajak Terhutang, dan NTPN/NTPD tersedia.`);
    return parsed;
  });
  if (!records.length) errors.push("Tidak ada data pajak yang berhasil dinormalisasi dari workbook.");
  return { records, errors, sheetsRead };
}
function rupiah(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0); }
function plainNumber(value: number) { return new Intl.NumberFormat("id-ID").format(value || 0); }
function fileSize(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: index ? 1 : 0 }).format(value / 1024 ** index)} ${units[index]}`; }
function statusTone(status: string) { if (status === "Terverifikasi" || status === "Sudah ada NTPN/NTPD") return "success"; if (status === "Belum Lengkap" || status === "Belum ada NTPN/NTPD" || status === "Data kosong") return "warning"; if (status === "Lebih Bayar" || status === "Kompensasi" || status === "Lebih bayar" || status === "Kompensasi lebih bayar") return "destructive"; return "secondary"; }
function sum(rows: TaxTransaction[], type?: TaxType) { return rows.filter((r) => !type || r.jenisPajak === type).reduce((a, r) => a + r.pajakTerhutang, 0); }
function dpp(rows: TaxTransaction[], types?: TaxType[]) { return rows.filter((r) => !types || types.includes(r.jenisPajak)).reduce((a, r) => a + r.dpp, 0); }
function ppnOutput(rows: TaxTransaction[]) { return sum(rows, "PPN Keluaran") + rows.filter((r) => r.jenisPajak === "PPN").reduce((a, r) => a + (r.ppnKeluaran ?? r.dpp), 0); }
function ppnInput(rows: TaxTransaction[]) { return sum(rows, "PPN Masukan") + rows.filter((r) => r.jenisPajak === "PPN").reduce((a, r) => a + (r.ppnMasukan ?? 0), 0); }
function ppnNonCreditable(rows: TaxTransaction[]) { return sum(rows, "PM Tidak Dikreditkan") + rows.filter((r) => r.jenisPajak === "PPN").reduce((a, r) => a + (r.pmTidakDikreditkan ?? 0), 0); }
function ppnBalance(rows: TaxTransaction[]) { return ppnOutput(rows) - ppnInput(rows) + ppnNonCreditable(rows); }
function ppnPayment(rows: TaxTransaction[]) { return sum(rows, "Pembayaran PPN") + sum(rows, "PPN"); }
function totalTaxPayments(rows: TaxTransaction[]) { return ppnPayment(rows) + sum(rows, "PPh Pasal 21") + sum(rows, "PPh Pasal 23") + sum(rows, "PPh Final 4(2)") + sum(rows, "PB1") + sum(rows, "PPh UMKM"); }
function isManualInput(row: TaxTransaction) { return row.sourceData === "Manual Input"; }

type ManualForm = { id?: string; perusahaan: string; tahun: string; masaPajak: string; jenisPajak: TaxType; dpp: string; pajak: string; ntpnNtpd: string; tanggalBayar: string; status: string; keterangan: string; ppnKeluaran: string; ppnMasukan: string; pmTidakDikreditkan: string; totalPembayaranPpn: string };
const emptyManualForm = (page: Page): ManualForm => ({ id: undefined, perusahaan: "", tahun: DEFAULT_DASHBOARD_YEAR, masaPajak: "", jenisPajak: page === "pb1" ? "PB1" : page === "ppn" ? "PPN" : page === "umkm" ? "PPh UMKM" : page === "unifikasi" ? "PPh Pasal 23" : "PPh Pasal 21", dpp: "", pajak: "", ntpnNtpd: "", tanggalBayar: "", status: "", keterangan: "", ppnKeluaran: "", ppnMasukan: "", pmTidakDikreditkan: "", totalPembayaranPpn: "" });
function manualButtonLabel(page: Page) { if (page === "dashboard") return "+ Tambah Data Pajak Manual"; if (page === "ppn") return "+ Tambah Data PPN"; if (page === "pb1") return "+ Tambah Data PB 1"; return "+ Tambah Data PPh"; }
function isManualPage(page: Page) { return page !== "documents"; }
function normalizeManualRecord(form: ManualForm): TaxTransaction {
  const isPpn = form.jenisPajak === "PPN";
  const dppNumber = isPpn ? numberValue(form.ppnKeluaran) : numberValue(form.dpp);
  const computedPpn = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan) + numberValue(form.pmTidakDikreditkan);
  const pajakTerhutang = isPpn ? (clean(form.totalPembayaranPpn) ? numberValue(form.totalPembayaranPpn) : computedPpn) : numberValue(form.pajak);
  const statusAuto = automaticStatus(pajakTerhutang, form.ntpnNtpd, form.keterangan, dppNumber);
  const now = new Date().toISOString();
  return { id: form.id || `manual-${crypto.randomUUID()}`, perusahaan: clean(form.perusahaan), tahun: clean(form.tahun), masaPajak: clean(form.masaPajak), jenisPajak: form.jenisPajak, dpp: dppNumber, pajakTerhutang, ntpnNtpd: clean(form.ntpnNtpd), tanggalBayar: normalizePaymentDate(form.tanggalBayar), ppnKeluaran: isPpn ? numberValue(form.ppnKeluaran) : undefined, ppnMasukan: isPpn ? numberValue(form.ppnMasukan) : undefined, pmTidakDikreditkan: isPpn ? numberValue(form.pmTidakDikreditkan) : undefined, status: clean(form.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(form.keterangan) || (isPpn ? `PPN Keluaran ${rupiah(numberValue(form.ppnKeluaran))}; PPN Masukan ${rupiah(numberValue(form.ppnMasukan))}; PM Tidak Dikreditkan ${rupiah(numberValue(form.pmTidakDikreditkan))}` : ""), sourceData: "Manual Input", sourceSheet: "Manual Input", sourceRow: 0, createdAt: now, updatedAt: now };
}
function validateManualForm(form: ManualForm) {
  const errors: Record<string, string> = {};
  if (!clean(form.perusahaan)) errors.perusahaan = "Perusahaan wajib diisi.";
  if (!clean(form.tahun)) errors.tahun = "Tahun wajib diisi.";
  if (!clean(form.masaPajak)) errors.masaPajak = "Masa Pajak wajib diisi.";
  if (!clean(form.jenisPajak)) errors.jenisPajak = "Jenis Pajak wajib diisi.";
  if (clean(form.tanggalBayar) && !/^\d{2}\/\d{2}\/\d{4}$/.test(normalizePaymentDate(form.tanggalBayar))) errors.tanggalBayar = "Tanggal Bayar harus format dd/mm/yyyy.";
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
  return { id: clean(row.id) || `static-${index + 1}`, perusahaan: clean(row.perusahaan) || "Perusahaan Belum Diisi", tahun: clean(row.tahun) || periodYear(clean(row.masaPajak ?? row.masa_pajak)), masaPajak: clean(row.masaPajak ?? row.masa_pajak) || "-", jenisPajak: (row.jenisPajak ?? row.jenis_pajak ?? "PPh Pasal 21") as TaxType, dpp: dppValue, pajakTerhutang: pajakValue, ntpnNtpd, tanggalBayar: normalizePaymentDate(row.tanggalBayar ?? row.tanggal_bayar), ppnKeluaran: numberValue(row.ppnKeluaran ?? row.ppn_keluaran), ppnMasukan: numberValue(row.ppnMasukan ?? row.ppn_masukan), pmTidakDikreditkan: numberValue(row.pmTidakDikreditkan ?? row.pm_tidak_dikreditkan), status: clean(row.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(row.keterangan), sourceData: row.sourceData ?? row.source_data ?? "Static File", sourceSheet: clean(row.sourceSheet ?? row.source_sheet) || "tax-data.json", sourceRow: Number(row.sourceRow ?? row.source_row) || index + 1, uploadBatchId: row.uploadBatchId ?? row.upload_batch_id, createdAt: clean(row.createdAt ?? row.created_at), updatedAt: clean(row.updatedAt ?? row.updated_at) };
}
function toStaticEntry(row: TaxTransaction) {
  return { id: row.id, perusahaan: row.perusahaan, tahun: row.tahun, masaPajak: row.masaPajak, jenisPajak: row.jenisPajak, dpp: row.dpp, pajak: row.pajakTerhutang, ntpnNtpd: row.ntpnNtpd, tanggalBayar: normalizePaymentDate(row.tanggalBayar), ppnKeluaran: row.ppnKeluaran || 0, ppnMasukan: row.ppnMasukan || 0, pmTidakDikreditkan: row.pmTidakDikreditkan || 0, status: row.status, statusAuto: row.statusAuto || "", keterangan: row.keterangan, sourceData: row.sourceData || "Static File", sourceSheet: row.sourceSheet, createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || new Date().toISOString() };
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
  const [records, setRecords] = useState<TaxTransaction[]>([]);
  const [summaryOverrides, setSummaryOverrides] = useState<SummaryOverrides>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [pdfDocuments, setPdfDocuments] = useState<UploadedPdfDocument[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ tahun: DEFAULT_DASHBOARD_YEAR, masaPajak: ALL, perusahaan: ALL, jenisPajak: ALL, status: ALL, search: "" });
  const [message, setMessage] = useState("Data utama dibaca dari Vercel Blob tax-dashboard-data.json.");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyManualForm("dashboard"));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  async function loadPdfDocuments() {
    const response = await fetch("/api/tax-documents", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ documents: [] }));
    setPdfDocuments(Array.isArray(payload.documents) ? payload.documents : []);
  }
  async function refreshData() {
    setLoading(true); setError(""); setMessage("Memuat data pajak dari Vercel Blob...");
    try {
      const response = await fetch("/api/tax-data", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ records: [], summaryOverrides: {}, updatedAt: null }));
      const loaded = Array.isArray(payload.records) ? payload.records.map(normalizeStaticEntry) : [];
      setRecords(loaded); setSummaryOverrides(payload.summaryOverrides ?? {}); setLastSaved(payload.updatedAt ?? null); setUploadBatches([]);
      await loadPdfDocuments();
      setMessage(loaded.length ? "Data berhasil dimuat dari Blob bersama." : "Blob kosong. Dashboard tampil Rp 0 sampai data diimport/manual lalu Save to Cloud.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data Blob.");
    } finally { setLoading(false); }
  }
  async function verifyPassword() {
    const password = window.prompt("Masukkan password edit");
    if (!password) return null;
    const response = await fetch("/api/verify-edit-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!response.ok) { setError("Password salah. Aksi dibatalkan."); return null; }
    return password;
  }
  async function saveToCloud() {
    const password = await verifyPassword(); if (!password) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/tax-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ records: records.map(toStaticEntry), summaryOverrides }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Save to Cloud gagal.");
      setLastSaved(payload.updatedAt); setMessage("Save to Cloud berhasil. Data sudah shared via Vercel Blob.");
    } catch (err) { setError(err instanceof Error ? err.message : "Save to Cloud gagal."); } finally { setBusy(false); }
  }
  function mapTaxRecord(row: TaxRecord): TaxTransaction {
    const statusAuto = automaticStatus(row.pajakTerutang, row.ntpnNtpd, row.keterangan || "", row.dpp);
    return { id: row.id, perusahaan: row.company, masaPajak: row.masa, tahun: periodYear(row.masa), jenisPajak: row.jenisPajak as TaxType, dpp: row.dpp, pajakTerhutang: row.pajakTerutang, ntpnNtpd: row.ntpnNtpd, status: row.status || displayStatus(statusAuto), statusAuto, keterangan: row.keterangan || "", sourceData: "Excel Import", sourceSheet: row.sourceSheet, sourceRow: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  useEffect(() => { const saved = localStorage.getItem(FILTER_STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as Partial<Filters>; setFilters({ tahun: parsed.tahun ?? DEFAULT_DASHBOARD_YEAR, masaPajak: parsed.masaPajak ?? ALL, perusahaan: parsed.perusahaan ?? ALL, jenisPajak: parsed.jenisPajak ?? ALL, status: parsed.status ?? ALL, search: parsed.search ?? "" }); } refreshData(); }, []);
  useEffect(() => localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters)), [filters]);
  const baseRows = useMemo(() => pageMeta[page].types ? records.filter((r) => pageMeta[page].types?.includes(r.jenisPajak)) : records, [page, records]);
  const filtered = useMemo(() => baseRows.filter((r) => (filters.tahun === ALL || r.tahun === filters.tahun) && (filters.masaPajak === ALL || r.masaPajak === filters.masaPajak) && (filters.perusahaan === ALL || r.perusahaan === filters.perusahaan) && (filters.jenisPajak === ALL || r.jenisPajak === filters.jenisPajak) && (filters.status === ALL || r.status === filters.status) && (!filters.search || `${r.perusahaan} ${r.ntpnNtpd} ${r.jenisPajak} ${r.keterangan}`.toLowerCase().includes(filters.search.toLowerCase()))), [baseRows, filters]);
  const options = (key: keyof TaxTransaction) => Array.from(new Set(records.map((r) => String(r[key] ?? "")))).filter(Boolean).sort((a, b) => key === "masaPajak" ? periodSort(a) - periodSort(b) : a.localeCompare(b));
  const summaryRows = useMemo(() => filtered.filter(isManualInput), [filtered]);
  const meta = pageMeta[page];

  function updateFilter(key: keyof Filters, value: string) { setFilters((cur) => ({ ...cur, [key]: value })); }
  function openManual(entry?: TaxTransaction) { setFormErrors({}); setForm(entry ? { ...emptyManualForm(page), id: entry.id, perusahaan: entry.perusahaan, tahun: entry.tahun, masaPajak: entry.masaPajak, jenisPajak: entry.jenisPajak, dpp: String(entry.dpp), pajak: String(entry.pajakTerhutang), ntpnNtpd: entry.ntpnNtpd, tanggalBayar: normalizePaymentDate(entry.tanggalBayar), status: entry.status, keterangan: entry.keterangan, ppnKeluaran: entry.jenisPajak === "PPN" ? String(entry.ppnKeluaran ?? entry.dpp) : "", ppnMasukan: entry.jenisPajak === "PPN" ? String(entry.ppnMasukan ?? "") : "", pmTidakDikreditkan: entry.jenisPajak === "PPN" ? String(entry.pmTidakDikreditkan ?? "") : "", totalPembayaranPpn: entry.jenisPajak === "PPN" ? String(entry.pajakTerhutang) : "" } : emptyManualForm(page)); setModalOpen(true); }
  async function saveManual() { const password = await verifyPassword(); if (!password) return; const errors = validateManualForm(form); setFormErrors(errors); if (Object.keys(errors).length) return; setBusy(true); const next = normalizeManualRecord(form); setRecords((rows) => form.id ? rows.map((row) => row.id === form.id ? next : row) : [...rows, next]); setMessage("Data manual mengubah state utama. Klik Save to Cloud agar tersimpan shared."); setModalOpen(false); setBusy(false); }
  async function deleteManual(id: string) { const password = await verifyPassword(); if (!password) return; if (!confirm("Apakah Anda yakin ingin menghapus record ini?")) return; setRecords((rows) => rows.filter((row) => row.id !== id)); setMessage("Record dihapus dari state utama. Klik Save to Cloud agar tersimpan shared."); }
  function deleteBatch(id: string) { if (!confirm("Hapus riwayat upload dari tampilan? Data record tetap ada sampai dihapus per record.")) return; setUploadBatches((rows) => rows.filter((row) => row.id !== id)); }
  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.type !== "application/pdf" && !(file.type === "" && file.name.toLowerCase().endsWith(".pdf"))) { setError("File harus berformat PDF."); event.target.value = ""; return; }
    setPdfUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/tax-documents", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Upload PDF gagal.");
      await loadPdfDocuments();
      setMessage("Upload PDF berhasil dan tersimpan ke cloud.");
    } catch (err) { setError(err instanceof Error ? err.message : "Upload PDF gagal."); } finally { setPdfUploading(false); event.target.value = ""; }
  }
  function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setError("Upload hanya menerima file .xlsx."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const password = await verifyPassword(); if (!password) { event.target.value = ""; return; }
      setBusy(true); setMessage("Memproses Excel...");
      try {
        const parsed = parseTaxWorkbook(reader.result as ArrayBuffer);
        const rows = parsed.map(mapTaxRecord);
        const perSheet = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.sourceSheet]: (acc[row.sourceSheet] || 0) + 1 }), {});
        const warnings = rows.filter((r) => !r.perusahaan || !r.masaPajak || r.pajakTerhutang <= 0 || !r.ntpnNtpd || r.ntpnNtpd === "-").length;
        const preview = `Preview import: ${rows.length} records; per sheet ${Object.entries(perSheet).map(([k,v]) => `${k}: ${v}`).join(", ")}; warnings ${warnings}.`;
        const append = confirm(`${preview}\n\nOK = Append to existing data. Cancel = Replace existing data.`);
        setRecords((current) => append ? [...current, ...rows] : rows);
        setUploadBatches((current) => [{ id: `upload-${crypto.randomUUID()}`, file_name: file.name, uploaded_at: new Date().toISOString(), total_rows: rows.length, uploaded_by: "verified-user", status: "success", error_message: `${warnings} warnings` }, ...current]);
        setMessage(`${preview} Dashboard sudah berubah. Klik Save to Cloud untuk persist ke Blob.`);
      } catch (err) { console.error("[tax-dashboard] Gagal memproses upload Excel", err); setError(err instanceof Error ? err.message : "Data Excel gagal diproses."); } finally { setBusy(false); event.target.value = ""; }
    };
    reader.readAsArrayBuffer(file);
  }

  return <main className="min-h-screen bg-[#EEF3F8] text-slate-950">
    <Sidebar page={page} setPage={setPage} open={drawerOpen} setOpen={setDrawerOpen} />
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 border-b border-[#D8E0EA] bg-[#EEF3F8]/90 px-4 py-3 backdrop-blur lg:hidden"><Button variant="outline" onClick={() => setDrawerOpen(true)}><Menu className="h-4 w-4" /> Menu</Button></header>
      <section className="space-y-6 p-4 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>{meta.subtitle && <p className="mt-2 text-base font-medium text-slate-600">{meta.subtitle}</p>}</div>{isManualPage(page) && page !== "dashboard" && <Button onClick={() => openManual()} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> {manualButtonLabel(page)}</Button>}</div>
        <FilterBar filters={filters} updateFilter={updateFilter} options={{ tahun: options("tahun"), masaPajak: options("masaPajak"), perusahaan: options("perusahaan"), jenisPajak: TAX_TYPES.filter((type) => !meta.types || meta.types.includes(type)), status: STATUSES }} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} onSave={saveToCloud} saving={busy} showDataEntryActions={page !== "dashboard"} />
        <Input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
        <Input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" onChange={uploadPdf} className="hidden" />
        <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />{loading ? "Memuat data pajak..." : message}{!records.length && !loading && " KPI akan menampilkan 0 sampai data tersedia."}{lastSaved && <span className="ml-2 text-slate-500">Last saved: {new Date(lastSaved).toLocaleString("id-ID")}</span>}</div>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {page === "documents" ? <Documents documents={pdfDocuments} uploading={pdfUploading} onUpload={() => pdfInputRef.current?.click()} /> : <><KpiGrid items={buildKpis(page, summaryRows, summaryOverrides)} onEdit={async (label, value) => { const password = await verifyPassword(); if (!password) return; const input = window.prompt(`Edit nominal ${label}`, String(value)); if (input === null) return; if (input === "") { setSummaryOverrides((cur) => { const next = { ...cur }; delete next[label]; return next; }); } else { setSummaryOverrides((cur) => ({ ...cur, [label]: numberValue(input) })); } setMessage("Override summary diubah. Klik Save to Cloud untuk persist."); }} /><DataQuality rows={summaryRows} /><TransactionTable rows={summaryRows} title={page === "dashboard" ? "Resume Pembayaran Pajak" : `Tabel detail ${meta.title}`} isDashboard={page === "dashboard"} onEdit={openManual} onDelete={deleteManual} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} /></>}
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
function FilterBar({ filters, updateFilter, options, onUpload, onManual, onSave, saving, showDataEntryActions = true }: { filters: Filters; updateFilter: (key: keyof Filters, value: string) => void; options: { tahun: string[]; masaPajak: string[]; perusahaan: string[]; jenisPajak: readonly string[]; status: readonly string[] }; onUpload: () => void; onManual: () => void; onSave: () => void; saving: boolean; showDataEntryActions?: boolean }) {
  const selects: [keyof Filters, string, readonly string[]][] = [["tahun", "Semua Tahun", options.tahun], ["masaPajak", "Semua Masa Pajak", options.masaPajak], ["perusahaan", "Semua Perusahaan", options.perusahaan], ["jenisPajak", "Semua Jenis Pajak", options.jenisPajak], ["status", "Semua Status", options.status]];
  return <Card className="rounded-3xl border-[#D8E0EA] shadow-sm"><CardContent className="flex flex-wrap items-center gap-3 p-4">{selects.map(([key, placeholder, values]) => <Select key={key} value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)} className="h-11 min-w-0 flex-1 basis-full rounded-2xl bg-white sm:basis-[calc(50%-0.75rem)] lg:basis-44"><option value={ALL}>{placeholder}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}</Select>)}<div className="relative min-w-0 flex-1 basis-full lg:basis-72"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Cari perusahaan, NTPN, jenis pajak..." className="h-11 rounded-2xl bg-white pl-9" /></div><div className="flex w-full flex-wrap gap-3 sm:w-auto sm:flex-nowrap">{showDataEntryActions && <><Button onClick={onUpload} className="h-11 flex-1 rounded-2xl bg-blue-600 font-bold hover:bg-blue-700 sm:flex-none"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="h-11 flex-1 rounded-2xl font-bold sm:flex-none"><Plus className="h-4 w-4" /> Manual</Button></>}<Button onClick={onSave} disabled={saving} variant="outline" className="h-11 flex-1 rounded-2xl font-bold sm:flex-none">Save to Cloud</Button></div></CardContent></Card>;
}
function buildKpis(page: Page, rows: TaxTransaction[], _overrides: SummaryOverrides = {}): KpiItem[] {
  void _overrides;
  if (page === "ppn") return [{ label: "Total PPN Keluaran", value: ppnOutput(rows), money: true }, { label: "Total PPN Masukan", value: ppnInput(rows), money: true }, { label: "PM Tidak Dikreditkan", value: ppnNonCreditable(rows), money: true }, { label: "Kurang Bayar/Lebih Bayar", value: ppnBalance(rows), money: true }, { label: "Total Pembayaran PPN", value: ppnPayment(rows), money: true }];
  if (page === "pph21") return [{ label: "Total DPP PPh 21", value: dpp(rows), money: true }, { label: "Total PPh 21", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "unifikasi") return [{ label: "Total PPh 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total DPP", value: dpp(rows), money: true }, { label: "Total pembayaran", value: sum(rows), money: true }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "pb1") return [{ label: "Total DPP PB1", value: dpp(rows), money: true }, { label: "Total PB1", value: sum(rows), money: true }, { label: "Jumlah NTPD", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPD kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "umkm") return [{ label: "Total DPP UMKM", value: dpp(rows), money: true }, { label: "Total PPh UMKM", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  return [{ label: "Total PPN Keluaran", value: ppnOutput(rows), money: true }, { label: "Total PPN Masukan", value: ppnInput(rows), money: true }, { label: "Total PM Tidak Dikreditkan", value: ppnNonCreditable(rows), money: true }, { label: "Total Pembayaran PPN", value: ppnPayment(rows), money: true }, { label: "Total PPh Pasal 21", value: sum(rows, "PPh Pasal 21"), money: true }, { label: "Total PPh Pasal 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total PB1", value: sum(rows, "PB1"), money: true }, { label: "Total PPh UMKM", value: sum(rows, "PPh UMKM"), money: true }, { label: "Total seluruh pembayaran pajak", value: totalTaxPayments(rows), money: true }, { label: "Jumlah perusahaan", value: new Set(rows.map((r) => r.perusahaan)).size }, { label: "Jumlah masa pajak", value: new Set(rows.map((r) => r.masaPajak)).size }, { label: "Jumlah NTPN/NTPD terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "Belum memiliki NTPN/NTPD", value: rows.filter((r) => !r.ntpnNtpd).length }];
}
function KpiGrid({ items, onEdit }: { items: KpiItem[]; onEdit: (label: string, value: number) => void }) { return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</p>{item.money && <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit nominal / kosongkan input untuk Reset override" onClick={() => onEdit(item.label, item.value)}><Edit3 className="h-3.5 w-3.5" /></Button>}</div><p className="mt-3 text-2xl font-black text-slate-950">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p></CardContent></Card>)}</section>; }
function DataQuality({ rows }: { rows: TaxTransaction[] }) {
  const issues = rows.filter((r) => !r.ntpnNtpd || r.pajakTerhutang === 0 || r.pajakTerhutang < 0 || /lebih bayar|kompensasi/i.test(`${r.statusAuto} ${r.keterangan}`) || !r.dpp || !r.masaPajak || !r.perusahaan);
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Data Quality</CardTitle><CardDescription>{issues.length} data perlu review: NTPN/NTPD kosong, pajak 0/negatif, lebih bayar, kompensasi, DPP/masa/perusahaan kosong, atau data belum lengkap.</CardDescription></CardHeader></Card>;
}
function TransactionTable({ title, rows, isDashboard, onEdit, onDelete, onUpload, onManual }: { title: string; rows: TaxTransaction[]; isDashboard: boolean; onEdit: (row: TaxTransaction) => void; onDelete: (id: string) => void; onUpload: () => void; onManual: () => void }) {
  const headers = isDashboard ? ["Perusahaan", "Masa Pajak", "Jenis Pajak", "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Keterangan", "Aksi"] : ["Perusahaan", "Masa Pajak", "Jenis Pajak", "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Hapus"];
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{rows.length} baris data.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((r) => <TableRow key={r.id} className="hover:bg-slate-50"><TableCell className="min-w-56 font-semibold">{r.perusahaan}</TableCell><TableCell>{r.masaPajak}</TableCell><TableCell>{r.jenisPajak}</TableCell><TableCell>{rupiah(r.dpp)}</TableCell><TableCell className={r.pajakTerhutang < 0 ? "font-bold text-red-600" : ""}>{rupiah(r.pajakTerhutang)}</TableCell><TableCell>{r.ntpnNtpd || "-"}</TableCell><TableCell><Badge variant={statusTone(r.status)}>{r.status === "Terverifikasi" && <CheckCircle2 className="mr-1 h-3 w-3" />}{r.status}</Badge><div className="mt-1 text-[11px] font-semibold text-slate-400">{r.statusAuto}</div></TableCell><TableCell><Badge variant={r.sourceData === "Manual Input" ? "success" : "secondary"}>{r.sourceData || "Excel Import"}</Badge></TableCell>{!isDashboard && <TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></TableCell>}{isDashboard && <><TableCell className="min-w-72">{r.keterangan || `${r.sourceSheet} baris ${r.sourceRow}`}</TableCell><TableCell>{r.sourceData === "Manual Input" ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(r)}><Edit3 className="h-3 w-3" /> Edit</Button><Button size="sm" variant="outline" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div> : <Badge variant="secondary">Excel Import</Badge>}</TableCell></>}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-36 text-center text-sm font-semibold text-slate-500"><div className="space-y-4"><p>{isDashboard ? "Belum ada data manual." : "Belum ada data. Upload Excel atau tambahkan data manual."}</p><div className="flex justify-center gap-3">{!isDashboard && <><Button onClick={onUpload} className="rounded-2xl bg-blue-600"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="rounded-2xl"><Plus className="h-4 w-4" /> Tambah Data Manual</Button></>}</div></div></TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}
function ManualModal({ page, form, setForm, errors, onClose, onSave, saving }: { page: Page; form: ManualForm; setForm: (form: ManualForm) => void; errors: Record<string, string>; onClose: () => void; onSave: () => void; saving: boolean }) {
  const set = (key: keyof ManualForm, value: string) => setForm({ ...form, [key]: value });
  const ppnComputed = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan) + numberValue(form.pmTidakDikreditkan);
  const taxOptions = page === "ppn" ? ["PPN"] : page === "pb1" ? ["PB1"] : page === "dashboard" ? ["PPN", ...PPH_TYPES, "PB1"] : PPH_TYPES;
  const field = (key: keyof ManualForm, label: string, type = "text", placeholder = "") => <div><label className="text-xs font-extrabold uppercase text-slate-500">{label}</label><Input type={type} value={String(form[key] ?? "")} onChange={(e) => set(key, type === "date" ? normalizePaymentDate(e.target.value) : e.target.value)} placeholder={placeholder} className="mt-1 h-11 rounded-2xl" />{errors[key] && <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p>}</div>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-black">{form.id ? "Edit Data Pajak Manual" : manualButtonLabel(page)}</h2><p className="text-sm font-medium text-slate-500">Source Data dan Source Sheet otomatis disimpan sebagai Manual Input.</p><p className="mt-2 rounded-2xl bg-blue-50 p-3 text-xs font-semibold text-blue-700">Tanpa database, data manual hanya tersimpan di browser ini. Source Data dan Source Sheet tetap disimpan sebagai informasi internal saat data diekspor oleh admin.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 md:grid-cols-2">{field("perusahaan", "Perusahaan")}{field("tahun", "Tahun")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Masa Pajak</label><Select value={form.masaPajak} onChange={(e) => set("masaPajak", e.target.value)} className="mt-1 h-11 rounded-2xl"><option value="">Pilih Masa Pajak</option>{MONTH_NAMES.map((month) => <option key={month} value={month}>{month}</option>)}</Select>{errors.masaPajak && <p className="mt-1 text-xs font-semibold text-red-600">{errors.masaPajak}</p>}</div><div><label className="text-xs font-extrabold uppercase text-slate-500">Jenis Pajak</label><Select value={form.jenisPajak} onChange={(e) => set("jenisPajak", e.target.value)} className="mt-1 h-11 rounded-2xl">{taxOptions.map((t) => <option key={t} value={t}>{t}</option>)}</Select>{errors.jenisPajak && <p className="mt-1 text-xs font-semibold text-red-600">{errors.jenisPajak}</p>}</div>{form.jenisPajak === "PPN" ? <>{field("ppnKeluaran", "PPN Keluaran")}{field("ppnMasukan", "PPN Masukan")}{field("pmTidakDikreditkan", "PM Tidak Dikreditkan")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Kurang Bayar / Lebih Bayar</label><Input value={rupiah(ppnComputed)} readOnly className="mt-1 h-11 rounded-2xl bg-slate-50" /></div>{field("totalPembayaranPpn", "Total Pembayaran PPN")}</> : <>{field("dpp", form.jenisPajak === "PB1" ? "DPP PB 1" : "DPP")}{field("pajak", form.jenisPajak === "PB1" ? "Nilai PB 1" : "Nilai Pajak / Pajak Terutang")}</>}{field("ntpnNtpd", form.jenisPajak === "PB1" ? "NTPD" : "NTPN/NTPD")}{field("tanggalBayar", "Tanggal Bayar", "text", "dd/mm/yyyy")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Status Manual (opsional)</label><Select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 h-11 rounded-2xl"><option value="">Gunakan status otomatis</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select></div><div className="md:col-span-2">{field("keterangan", "Keterangan")}</div></div><div className="mt-6 flex justify-end gap-3"><Button variant="outline" className="rounded-2xl" onClick={onClose}>Batal</Button><Button className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700" onClick={onSave} disabled={saving}>{saving ? "Menyimpan..." : form.id ? "Simpan Perubahan" : "Simpan"}</Button></div></div></div>;
}
function UploadHistory({ batches, onDelete }: { batches: UploadBatch[]; onDelete: (id: string) => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Riwayat Upload Excel</CardTitle><CardDescription>{batches.length ? `${batches.length} batch upload dari file statis/sesi browser.` : "Belum ada upload Excel yang tersimpan di file statis."}</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Nama File", "Tanggal Upload", "Jumlah Baris", "Status", "Error", "Aksi"].map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{batches.length ? batches.map((b) => <TableRow key={b.id}><TableCell className="font-semibold">{b.file_name}</TableCell><TableCell>{new Date(b.uploaded_at).toLocaleString("id-ID")}</TableCell><TableCell>{plainNumber(b.total_rows)}</TableCell><TableCell><Badge variant={b.status === "success" ? "success" : "warning"}>{b.status}</Badge></TableCell><TableCell className="max-w-md truncate">{b.error_message || "-"}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => onDelete(b.id)}><Trash2 className="h-3 w-3" /> Hapus Data Upload Ini</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-20 text-center text-sm font-semibold text-slate-500">Belum ada upload Excel yang tersimpan di file statis. Upload di browser akan tampil sementara di sini dan bisa diekspor ke upload-history.json.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}

function Documents({ documents, uploading, onUpload }: { documents: UploadedPdfDocument[]; uploading: boolean; onUpload: () => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle>Dokumen Pajak</CardTitle><CardDescription>{documents.length} file PDF sudah diupload dari cloud.</CardDescription></div><Button onClick={onUpload} disabled={uploading} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Upload className="h-4 w-4" /> {uploading ? "Mengupload..." : "Upload PDF"}</Button></div></CardHeader><CardContent className="space-y-3">{documents.length ? documents.map((doc) => <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-950">{doc.name}</p><p className="text-sm text-slate-500">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString("id-ID") : "Tanggal upload tidak tersedia"} • {fileSize(doc.size)}{doc.type ? ` • ${doc.type}` : ""}</p></div><div className="flex flex-wrap gap-2"><a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Eye className="h-3 w-3" /> Lihat</a><a href={doc.url} download={doc.name} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Download className="h-3 w-3" /> Download</a></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-semibold text-slate-500">Belum ada PDF yang diupload. Klik Upload PDF untuk menambahkan dokumen pajak.</div>}</CardContent></Card>;
}
