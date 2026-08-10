"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parsePageTaxWorkbook, type TaxRecord, type UploadTaxPage } from "@/src/lib/parseTaxWorkbook";
import { Building2, CalendarDays, CheckCircle2, ChevronDown, Download, Edit3, Eye, FileArchive, FileSpreadsheet, FileText, Gavel, Home, Landmark, LogOut, Menu, Plus, Receipt, ShieldCheck, ShieldX, TrendingDown, TrendingUp, Trash2, Upload, WalletCards, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { canAccessArea, type UserRole } from "@/lib/user-access";
import { ControlOmzetDashboard } from "@/components/control-omzet-dashboard";
import type { ControlOmzetRow } from "@/lib/control-omzet";
import { CashflowDashboard, type CashflowPage } from "@/components/cashflow-dashboard";
import { LegalDocumentDashboard, type LegalPage } from "@/components/legal-document-dashboard";

const FILTER_STORAGE_KEY = "tax-dashboard-filters-v1";
const DEFAULT_DASHBOARD_YEAR = "2026";
const ALL = "__all__";
const TAX_TYPES = ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN", "PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PB1", "PPh UMKM"] as const;
const STATUSES = ["Terverifikasi", "Belum Lengkap", "Nihil", "Lebih Bayar", "Kompensasi", "Sudah ada NTPN/NTPD", "Belum ada NTPN/NTPD", "Nilai pajak 0", "Data kosong"] as const;
const DASHBOARD_FILTER_TAX_TYPES: TaxType[] = ["PPN", "PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PB1", "PPh UMKM"];
const FILTER_STATUSES = STATUSES.filter((status) => !["Nilai pajak 0", "Data kosong"].includes(status));
const PAYMENT_DATE_MIN = "2026-01-01";
const PAYMENT_DATE_MAX = "2026-12-31";
const PPH_TYPES: TaxType[] = ["PPh Pasal 21", "PPh Pasal 23", "PPh Final 4(2)", "PPh UMKM"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;
const PROFESSIONAL_FONT_STACK = "Inter, 'Plus Jakarta Sans', Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

type TaxType = (typeof TAX_TYPES)[number];
type Status = (typeof STATUSES)[number];
type Page = "dashboard" | "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm" | "documents" | "controlOmzet" | "financeOverview" | "financeDetails" | "financeDevices" | "financeObsidian" | "finance1001" | "financeResto" | CashflowPage | LegalPage;
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
  totalPembayaranPpn?: number;
  uploadBatchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Filters = { tahun: string; masaPajak: string; perusahaan: string; jenisPajak: string; status: string; search: string };
type UploadBatch = { id: string; file_name: string; uploaded_at: string; total_rows: number; uploaded_by: string; status: string; error_message: string };
type UploadedPdfDocument = { id: string; originalName?: string; name: string; pathname?: string; uploadedAt: string | null; size: number; type?: string; url?: string };
type StaticTaxEntry = { id?: string; perusahaan?: string; tahun?: string; masaPajak?: string; masa_pajak?: string; jenisPajak?: TaxType; jenis_pajak?: TaxType; dpp?: number | string; pajak?: number | string; pajakTerhutang?: number | string; ntpnNtpd?: string; ntpn_ntpd?: string; tanggalBayar?: string | null; tanggal_bayar?: string | null; ppnKeluaran?: number | string; ppn_keluaran?: number | string; ppnMasukan?: number | string; ppn_masukan?: number | string; pmTidakDikreditkan?: number | string; pm_tidak_dikreditkan?: number | string; totalPembayaranPpn?: number | string; pembayaranPpn?: number | string; paymentAmount?: number | string; status?: string; statusAuto?: string; status_auto?: string; keterangan?: string; sourceData?: "Static File" | "Excel Import" | "Manual Input"; source_data?: "Static File" | "Excel Import" | "Manual Input"; sourceSheet?: string; source_sheet?: string; sourceRow?: number; source_row?: number; uploadBatchId?: string | null; upload_batch_id?: string | null; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string };

type SummaryOverrides = Record<string, number>;
type KpiItem = { label: string; value: number; money?: boolean };
type DashboardTaxKind = "PPN" | "PPh Pasal 21" | "PPh Unifikasi" | "PB1" | "UMKM";

const pageMeta: Record<Page, { title: string; subtitle: string; types?: TaxType[] }> = {
  dashboard: { title: "Dashboard Tax", subtitle: "" },
  ppn: { title: "PPN", subtitle: "Monitoring Pajak Pertambahan Nilai", types: ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN"] },
  pph21: { title: "PPh Pasal 21", subtitle: "Monitoring Pajak Atas Penghasilan Karyawan & Imbalan Atas Jasa", types: ["PPh Pasal 21"] },
  unifikasi: { title: "PPh Unifikasi", subtitle: "Monitoring Pajak Atas Jasa, Sewa dan Persewaan Atas Tanah Dan Bangunan", types: ["PPh Pasal 23", "PPh Final 4(2)"] },
  pb1: { title: "PB1", subtitle: "Monitoring Pajak Daerah", types: ["PB1"] },
  umkm: { title: "PPh UMKM", subtitle: "Monitoring Pajak Atas Usaha Mikro, Kecil dan Menengah", types: ["PPh UMKM"] },
  documents: { title: "Dokumen Pajak", subtitle: "Daftar SPT, Billing, dan SSP" },
  controlOmzet: { title: "Control Omzet", subtitle: "Monitoring omzet, omzet terlapor, selisih, dan persentase pelaporan per masa pajak." },
  financeOverview: { title: "Dashboard Finance", subtitle: "Overview saldo, brand details, dan device status dari Excel update saldo." },
  financeDetails: { title: "Brand Details", subtitle: "Struktur brand, group, entity, dan rekening finance." },
  financeDevices: { title: "Device Status", subtitle: "Monitoring device finance dan operasional." },
  financeObsidian: { title: "Finance Obsidian", subtitle: "Detail rekening dan saldo brand Obsidian." },
  finance1001: { title: "Finance 1001", subtitle: "Detail rekening dan saldo brand 1001." },
  financeResto: { title: "Finance Resto", subtitle: "Detail rekening dan saldo brand Resto." },
  cashflow: { title: "Cashflow", subtitle: "Monitoring proyeksi, realisasi, sisa cashflow, dan analisis over cashflow." },
  cashflowProjection: { title: "Cashflow · Proyeksi", subtitle: "Input dan pengelolaan data proyeksi cashflow." },
  cashflowActual: { title: "Cashflow · Realisasi", subtitle: "Input dan pengelolaan data realisasi pengeluaran dan pemasukan." },
  legalCompany: { title: "Company Profile", subtitle: "Informasi profil perusahaan dan dokumen pendukung legalitas." },
  legalDocuments: { title: "Document", subtitle: "Upload dan arsip dokumen legal perusahaan." },
};

const taxSubmenuItems = [
  ["ppn", Receipt, "PPN"], ["pph21", Receipt, "PPh Pasal 21"], ["unifikasi", Receipt, "PPh Unifikasi"], ["pb1", Building2, "PB1"], ["umkm", Building2, "PPh UMKM"], ["documents", FileArchive, "Dokumen Pajak"],
] as const;
const financeSubmenuItems = [
  ["financeDetails", Landmark, "Brand Details"], ["financeDevices", ShieldCheck, "Device Status"],
] as const;
const cashflowPages: CashflowPage[] = ["cashflow", "cashflowProjection", "cashflowActual"];
function isCashflowPage(page: Page): page is CashflowPage { return cashflowPages.includes(page as CashflowPage); }
const legalPages: LegalPage[] = ["legalCompany", "legalDocuments"];
function isLegalPage(page: Page): page is LegalPage { return legalPages.includes(page as LegalPage); }

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
  return MONTH_NAMES.findIndex((month, index) => text === month.toLowerCase() || text.startsWith(month.toLowerCase().slice(0, 3)) || text.startsWith(MONTHS[index].toLowerCase()) || (month === "Mei" && text.startsWith("may")) || (month === "Agustus" && text.startsWith("aug")) || (month === "Oktober" && text.startsWith("oct")) || (month === "Desember" && text.startsWith("dec")));
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
function toDateInputValue(value: unknown) {
  const normalized = normalizePaymentDate(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : clean(value);
}
function normalizePaymentDateForStorage(value: unknown) {
  const text = clean(value);
  if (!text) return "";
  const dateInputValue = toDateInputValue(text);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateInputValue) ? dateInputValue : "";
}
function normalizePeriod(value: unknown) {
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${MONTHS[d.m - 1]}-${String(Math.max(d.y, 2026)).slice(-2)}` : "-";
  }
  const text = clean(value);
  if (!text) return "-";
  const match = text.match(/(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*[\s/-]*(\d{2,4})?/i);
  if (match) {
    const idx = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"].findIndex((m) => match[1].toLowerCase().startsWith(m) || (m === "mei" && match[1].toLowerCase().startsWith("may")) || (m === "agu" && match[1].toLowerCase().startsWith("aug")) || (m === "okt" && match[1].toLowerCase().startsWith("oct")) || (m === "des" && match[1].toLowerCase().startsWith("dec")));
    const rawYear = match[2];
    return rawYear ? `${MONTHS[Math.max(idx, 0)]}-${String(normalizeYear(rawYear)).slice(-2)}` : MONTH_NAMES[Math.max(idx, 0)];
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${MONTHS[parsed.getMonth()]}-${String(Math.max(parsed.getFullYear(), 2026)).slice(-2)}`;
  return text;
}
function normalizeYear(value: unknown) { const year = Number(clean(value)); return Number.isFinite(year) && year >= 2026 ? String(Math.trunc(year)) : DEFAULT_DASHBOARD_YEAR; }
function periodYear(period: string) { const match = period.match(/(\d{2,4})$/); return match ? normalizeYear(match[1].length === 2 ? `20${match[1]}` : match[1]) : DEFAULT_DASHBOARD_YEAR; }
function periodSort(period: string) { const [m] = period.split("-"); const idx = monthIndex(m); return Number(periodYear(period)) * 100 + (idx >= 0 ? idx : 0); }
function matchesMonthFilter(period: string, selectedMonth: string) { const selectedIndex = monthIndex(selectedMonth); if (selectedIndex < 0) return period === selectedMonth; return monthIndex(period) === selectedIndex; }
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
function ppnBalance(rows: TaxTransaction[]) { return ppnOutput(rows) - ppnInput(rows); }
function ppnPaymentValue(row: TaxTransaction) { return row.jenisPajak === "Pembayaran PPN" ? numberValue(row.pajakTerhutang) : numberValue(row.totalPembayaranPpn); }
function ppnPayment(rows: TaxTransaction[]) { return rows.reduce((total, row) => total + ppnPaymentValue(row), 0); }
function totalTaxPayments(rows: TaxTransaction[]) { return ppnPayment(rows) + sum(rows, "PPh Pasal 21") + sum(rows, "PPh Pasal 23") + sum(rows, "PPh Final 4(2)") + sum(rows, "PB1") + sum(rows, "PPh UMKM"); }
function isPaid(row: TaxTransaction) { return Boolean(clean(row.ntpnNtpd)) || row.status === "Terverifikasi" || row.statusAuto === "Sudah ada NTPN/NTPD"; }
function dashboardKind(type: TaxType): DashboardTaxKind { if (["PPN", "PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN"].includes(type)) return "PPN"; if (type === "PPh Pasal 21") return "PPh Pasal 21"; if (type === "PPh Pasal 23" || type === "PPh Final 4(2)") return "PPh Unifikasi"; if (type === "PB1") return "PB1"; return "UMKM"; }



type FinanceAccountType = "Bank" | "Payment Gateway" | "Cash" | "Other";
type FinanceAccount = { id: string; brand: string; group: string; entity: string; accountName: string; provider: string; accountNumber: string; accountType: FinanceAccountType; balance: number; source: "Excel Import" | "Manual Input" | string; notes?: string };
type FinanceDeviceStatus = { id: string; area: string; status: string; number: string; device: string; notes: string };
type FinanceTab = "overview" | "details" | "devices";
type FinancePage = "financeOverview" | "financeDetails" | "financeDevices" | "financeObsidian" | "finance1001" | "financeResto";
type FinanceFilters = { search: string; group: string; sort: string };
const FINANCE_FILTER_STORAGE_KEY = "finance-dashboard-filters-v1";
const DEFAULT_FINANCE_BRANDS = ["1001", "MAISON Y", "Obsidian", "PADEL", "GOSE", "BAC", "OMG", "PT GLOBAL SEHAT BERKARYA", "TRIPLE EGG", "WOK", "HUNIAN", "PT SEBELUM HINGGA SESUDAH", "Resto"];
type FinanceStructureItem = { type: "entity" | "group"; name: string };
const DEFAULT_FINANCE_STRUCTURE: Record<string, FinanceStructureItem[]> = {
  Obsidian: [
    { type: "entity", name: "PT Prima Global Obsidian" },
    { type: "entity", name: "PT Sejuta Toko Bersama" },
    { type: "group", name: "Titip" },
  ],
  "1001": [
    { type: "entity", name: "CV Sepuluh Januari Sukses" },
    { type: "entity", name: "CV Event Seribu Satu" },
    { type: "entity", name: "PT Mimama Laku Selalu" },
    { type: "entity", name: "CV Seribu Toko Sukses" },
  ],
  Resto: [
    { type: "entity", name: "PT Makan Setiap Hari" },
    { type: "entity", name: "PT Minum Setiap Hari" },
    { type: "entity", name: "PT Jajan Setiap Hari" },
  ],
};
const DEFAULT_DEVICE_STATUS: FinanceDeviceStatus[] = [
  ["Online", "Perlu cek", "0811", "Android POS", "Follow up harian"], ["Gym", "OK", "0812", "iPhone Finance", "Aktif"], ["Store", "OK", "0813", "Android POS", "Aktif"], ["Finance Hunian", "Perlu cek", "0814", "iPhone Finance", "Follow up harian"], ["Jajan", "OK", "0815", "Android POS", "Aktif"], ["Maison PT", "OK", "0816", "iPhone Finance", "Aktif"], ["Maison CV", "Perlu cek", "0817", "Android POS", "Follow up harian"], ["Tax HO Jakarta", "OK", "0818", "iPhone Finance", "Aktif"], ["HRD HO Jakarta", "OK", "0819", "Android POS", "Aktif"], ["CS Maison", "Perlu cek", "0820", "iPhone Finance", "Follow up harian"],
].map(([area, status, number, device, notes]) => ({ id: `device-${crypto.randomUUID()}`, area, status, number, device, notes }));
function parseNumber(value: unknown) { return numberValue(value); }
function inferAccount(accountName: string): { provider: string; accountType: FinanceAccountType } { const t = accountName.toLowerCase(); if (t.includes("xendit")) return { provider: "Xendit", accountType: "Payment Gateway" }; if (t.includes("cash")) return { provider: "Cash", accountType: "Cash" }; for (const bank of ["BCA", "OCBC", "BRI", "Mandiri", "Permata"]) if (t.includes(bank.toLowerCase())) return { provider: bank, accountType: "Bank" }; return { provider: clean(accountName.split(/\s+/)[0]) || "Other", accountType: "Other" }; }
function normalizeFinanceBrand(value: string) { const text = clean(value); if (/^obsidian$/i.test(text)) return "Obsidian"; if (/^resto$/i.test(text)) return "Resto"; return text.toUpperCase() === "1001" ? "1001" : text; }
function normalizeFinanceAccount(row: Partial<Omit<FinanceAccount, "balance">> & { balance?: unknown }): FinanceAccount { const inferred = inferAccount(clean(row.accountName)); return { id: clean(row.id) || `finance-${crypto.randomUUID()}`, brand: normalizeFinanceBrand(clean(row.brand)) || "Brand Belum Diisi", group: clean(row.group) || "Default", entity: clean(row.entity) || "Entity Belum Diisi", accountName: clean(row.accountName) || "Account Belum Diisi", provider: clean(row.provider) || inferred.provider, accountNumber: clean(row.accountNumber), accountType: (clean(row.accountType) as FinanceAccountType) || inferred.accountType, balance: parseNumber(row.balance), source: row.source || "Excel Import", notes: clean(row.notes) }; }
function looksLikeBrand(text: string) { return /^(1001|gose|hunian|maison y|omg|obsidian|padel|triple egg|wok|resto)$/i.test(text); }
function looksLikeEntity(text: string) { return /^(pt|cv)\s+/i.test(text); }
function looksLikeAccount(text: string) { return /(bca|ocbc|bri|mandiri|permata|xendit|cash|bank|rekening)/i.test(text); }
function parseUpdateSaldoExcel(fileOrBuffer: ArrayBuffer): FinanceAccount[] {
  const wb = XLSX.read(fileOrBuffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((name) => name.toLowerCase().trim() === "update saldo") ?? wb.SheetNames[0];
  if (!sheetName) throw new Error("Sheet UPDATE SALDO tidak ditemukan");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
  let brand = "", group = "", entity = "";
  const accounts: FinanceAccount[] = [];
  rows.forEach((row, rowIndex) => {
    const cells = row.map(clean).filter(Boolean);
    if (!cells.length) return;
    if (cells.some((c) => /^sum\(/i.test(c) || /^total$/i.test(c))) return;
    const single = cells.length === 1 ? cells[0] : "";
    if (single && looksLikeBrand(single)) { brand = normalizeFinanceBrand(single); group = ""; entity = ""; return; }
    if (single && !looksLikeAccount(single) && !looksLikeEntity(single) && !/[0-9]/.test(single)) { group = single; return; }
    const brandCell = cells.find(looksLikeBrand); if (brandCell && !brand) brand = normalizeFinanceBrand(brandCell);
    const entityCell = cells.find(looksLikeEntity); if (entityCell) entity = entityCell;
    const accountCell = cells.find((c) => looksLikeAccount(c) && !/^bank$/i.test(c));
    if (!accountCell) { if (!single && cells[0] && !looksLikeEntity(cells[0]) && !looksLikeBrand(cells[0]) && !/[0-9]/.test(cells[0])) group = cells[0]; return; }
    const balanceCell = [...cells].reverse().find((c) => /\d/.test(c) && parseNumber(c) !== 0) ?? "0";
    const numberCell = cells.find((c) => c !== balanceCell && /\d{3,}/.test(c) && !looksLikeAccount(c)) ?? "";
    accounts.push(normalizeFinanceAccount({ id: `finance-${sheetName}-${rowIndex}-${crypto.randomUUID()}`, brand: brand || clean(cells.find(looksLikeBrand)) || "Brand Belum Diisi", group: group || "Default", entity: entity || clean(entityCell) || "Entity Belum Diisi", accountName: accountCell, accountNumber: numberCell, balance: balanceCell, source: "Excel Import" as const }));
  });
  if (!accounts.length && rows.some((r) => r.some((c) => clean(c)))) throw new Error("Format Excel update saldo tidak sesuai");
  return accounts;
}
function isFinancePage(page: Page): page is FinancePage { return ["financeOverview", "financeDetails", "financeDevices", "financeObsidian", "finance1001", "financeResto"].includes(page); }
function isFinanceAreaPage(page: Page) { return isFinancePage(page) || isCashflowPage(page); }
function financeBrand(page: FinancePage) { return page === "financeObsidian" ? "Obsidian" : page === "finance1001" ? "1001" : page === "financeResto" ? "Resto" : ""; }
function financeTabFromPage(page: Page): FinanceTab { if (page === "financeDetails" || page === "financeObsidian" || page === "finance1001" || page === "financeResto") return "details"; if (page === "financeDevices") return "devices"; return "overview"; }

type ManualForm = { id?: string; perusahaan: string; tahun: string; masaPajak: string; jenisPajak: TaxType; dpp: string; pajak: string; ntpnNtpd: string; tanggalBayar: string; status: string; keterangan: string; ppnKeluaran: string; ppnMasukan: string; pmTidakDikreditkan: string; totalPembayaranPpn: string };
const emptyManualForm = (page: Page): ManualForm => ({ id: undefined, perusahaan: "", tahun: DEFAULT_DASHBOARD_YEAR, masaPajak: "", jenisPajak: page === "pb1" ? "PB1" : page === "ppn" ? "PPN" : page === "umkm" ? "PPh UMKM" : page === "unifikasi" ? "PPh Pasal 23" : "PPh Pasal 21", dpp: "", pajak: "", ntpnNtpd: "", tanggalBayar: "", status: "", keterangan: "", ppnKeluaran: "", ppnMasukan: "", pmTidakDikreditkan: "", totalPembayaranPpn: "" });
function manualButtonLabel(page: Page) { if (page === "dashboard") return "+ Tambah Data Pajak Manual"; if (page === "ppn") return "+ Tambah Data PPN"; if (page === "pb1") return "+ Tambah Data PB 1"; return "+ Tambah Data PPh"; }
function isManualPage(page: Page) { return page !== "documents" && !isFinanceAreaPage(page); }
function normalizeManualRecord(form: ManualForm): TaxTransaction {
  const isPpn = form.jenisPajak === "PPN";
  const dppNumber = isPpn ? numberValue(form.ppnKeluaran) : numberValue(form.dpp);
  const computedPpn = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan);
  const pajakTerhutang = isPpn ? (clean(form.totalPembayaranPpn) ? numberValue(form.totalPembayaranPpn) : computedPpn) : numberValue(form.pajak);
  const statusAuto = automaticStatus(pajakTerhutang, form.ntpnNtpd, form.keterangan, dppNumber);
  const now = new Date().toISOString();
  return { id: form.id || `manual-${crypto.randomUUID()}`, perusahaan: clean(form.perusahaan), tahun: normalizeYear(form.tahun), masaPajak: clean(form.masaPajak), jenisPajak: form.jenisPajak, dpp: dppNumber, pajakTerhutang, ntpnNtpd: clean(form.ntpnNtpd), tanggalBayar: normalizePaymentDateForStorage(form.tanggalBayar), ppnKeluaran: isPpn ? numberValue(form.ppnKeluaran) : undefined, ppnMasukan: isPpn ? numberValue(form.ppnMasukan) : undefined, pmTidakDikreditkan: isPpn ? numberValue(form.pmTidakDikreditkan) : undefined, totalPembayaranPpn: isPpn ? numberValue(form.totalPembayaranPpn) : undefined, status: clean(form.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(form.keterangan) || (isPpn ? `PPN Keluaran ${rupiah(numberValue(form.ppnKeluaran))}; PPN Masukan ${rupiah(numberValue(form.ppnMasukan))}; PM Tidak Dikreditkan ${rupiah(numberValue(form.pmTidakDikreditkan))}` : ""), sourceData: "Manual Input", sourceSheet: "Manual Input", sourceRow: 0, createdAt: now, updatedAt: now };
}
function validateManualForm(form: ManualForm) {
  const errors: Record<string, string> = {};
  if (!clean(form.perusahaan)) errors.perusahaan = "Perusahaan wajib diisi.";
  if (!clean(form.tahun)) errors.tahun = "Tahun wajib diisi.";
  if (!clean(form.masaPajak)) errors.masaPajak = "Masa Pajak wajib diisi.";
  if (!clean(form.jenisPajak)) errors.jenisPajak = "Jenis Pajak wajib diisi.";
  if (clean(form.tanggalBayar)) {
    const dateInputValue = normalizePaymentDateForStorage(form.tanggalBayar);
    if (!dateInputValue) errors.tanggalBayar = "Tanggal Bayar harus dipilih dari kalender.";
    else if (dateInputValue < PAYMENT_DATE_MIN || dateInputValue > PAYMENT_DATE_MAX) errors.tanggalBayar = "Tanggal Bayar hanya boleh dari 01/01/2026 sampai 31/12/2026.";
  }
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
  const payment = row.totalPembayaranPpn ?? row.pembayaranPpn ?? row.paymentAmount;
  return { id: clean(row.id) || `static-${index + 1}`, perusahaan: clean(row.perusahaan) || "Perusahaan Belum Diisi", tahun: normalizeYear(row.tahun || periodYear(clean(row.masaPajak ?? row.masa_pajak))), masaPajak: clean(row.masaPajak ?? row.masa_pajak) || "-", jenisPajak: (row.jenisPajak ?? row.jenis_pajak ?? "PPh Pasal 21") as TaxType, dpp: dppValue, pajakTerhutang: pajakValue, ntpnNtpd, tanggalBayar: normalizePaymentDate(row.tanggalBayar ?? row.tanggal_bayar), ppnKeluaran: numberValue(row.ppnKeluaran ?? row.ppn_keluaran), ppnMasukan: numberValue(row.ppnMasukan ?? row.ppn_masukan), pmTidakDikreditkan: numberValue(row.pmTidakDikreditkan ?? row.pm_tidak_dikreditkan), totalPembayaranPpn: payment === undefined ? undefined : numberValue(payment), status: clean(row.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(row.keterangan), sourceData: row.sourceData ?? row.source_data ?? "Static File", sourceSheet: clean(row.sourceSheet ?? row.source_sheet) || "tax-data.json", sourceRow: Number(row.sourceRow ?? row.source_row) || index + 1, uploadBatchId: row.uploadBatchId ?? row.upload_batch_id, createdAt: clean(row.createdAt ?? row.created_at), updatedAt: clean(row.updatedAt ?? row.updated_at) };
}
function toStaticEntry(row: TaxTransaction) {
  return { id: row.id, perusahaan: row.perusahaan, tahun: row.tahun, masaPajak: row.masaPajak, jenisPajak: row.jenisPajak, dpp: row.dpp, pajak: row.pajakTerhutang, ntpnNtpd: row.ntpnNtpd, tanggalBayar: normalizePaymentDate(row.tanggalBayar), ppnKeluaran: row.ppnKeluaran || 0, ppnMasukan: row.ppnMasukan || 0, pmTidakDikreditkan: row.pmTidakDikreditkan || 0, totalPembayaranPpn: row.totalPembayaranPpn || 0, status: row.status, statusAuto: row.statusAuto || "", keterangan: row.keterangan, sourceData: row.sourceData || "Static File", sourceSheet: row.sourceSheet, createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || new Date().toISOString() };
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


export function TaxCoordinatorDashboard({ user, onLogout }: { user: { email: string; role: UserRole }; onLogout: () => void }) {
  const [records, setRecords] = useState<TaxTransaction[]>([]);
  const [controlOmzetData, setControlOmzetData] = useState<ControlOmzetRow[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [financeDevices, setFinanceDevices] = useState<FinanceDeviceStatus[]>(DEFAULT_DEVICE_STATUS);
  const [financeLastSaved, setFinanceLastSaved] = useState<string | null>(null);
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>({ search: "", group: ALL, sort: "structure" });
  const [summaryOverrides, setSummaryOverrides] = useState<SummaryOverrides>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [pdfDocuments, setPdfDocuments] = useState<UploadedPdfDocument[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>(user.role === "FINANCE_USER" ? "financeOverview" : "dashboard");
  const [accessDenied, setAccessDenied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ tahun: DEFAULT_DASHBOARD_YEAR, masaPajak: ALL, perusahaan: ALL, jenisPajak: ALL, status: ALL, search: "" });
  const [message, setMessage] = useState("Data utama dibaca dari Vercel Blob tax-dashboard-data.json.");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [quickSaldoOpen, setQuickSaldoOpen] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyManualForm("dashboard"));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const updateSaldoInputRef = useRef<HTMLInputElement>(null);
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
      await loadUpdateSaldoData();
      await loadControlOmzetData();
      setMessage(loaded.length ? "Data berhasil dimuat dari Blob bersama." : "Blob kosong. Dashboard tampil Rp 0 sampai data diimport/manual lalu Save to Cloud.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data Blob.");
    } finally { setLoading(false); }
  }
  async function loadControlOmzetData() {
    const response = await fetch("/api/control-omzet-data", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ controlOmzetData: [] }));
    setControlOmzetData(Array.isArray(payload.controlOmzetData) ? payload.controlOmzetData : []);
  }
  async function saveControlOmzetToCloud() {
    const password = await verifyPassword(); if (!password) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/control-omzet-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ controlOmzetData }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Save to Cloud Control Omzet gagal.");
      setMessage("Save to Cloud berhasil. controlOmzetData tersimpan terpisah.");
    } catch (err) { setError(err instanceof Error ? err.message : "Save to Cloud Control Omzet gagal."); } finally { setBusy(false); }
  }
  async function loadUpdateSaldoData() {
    const response = await fetch("/api/update-saldo-data", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ financeData: { accounts: [], deviceStatus: [] }, updatedAt: null }));
    const financeData = payload.financeData ?? payload;
    setFinanceAccounts(Array.isArray(financeData.accounts) ? financeData.accounts.map(normalizeFinanceAccount) : Array.isArray(payload.records) ? payload.records.map((r: Partial<FinanceAccount>) => normalizeFinanceAccount(r)) : []);
    setFinanceDevices(Array.isArray(financeData.deviceStatus) && financeData.deviceStatus.length ? financeData.deviceStatus : DEFAULT_DEVICE_STATUS);
    setFinanceLastSaved(financeData.lastUpdated ?? payload.updatedAt ?? null);
  }
  async function saveUpdateSaldoToCloud() {
    const password = await verifyPassword(); if (!password) return;
    setBusy(true); setError("");
    try {
      const financeData = { accounts: financeAccounts, deviceStatus: financeDevices, lastUpdated: new Date().toISOString() };
      const response = await fetch("/api/update-saldo-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ financeData }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Save to Cloud Dashboard Finance gagal.");
      setFinanceLastSaved(payload.updatedAt); setMessage("Save to Cloud Dashboard Finance berhasil. financeData tersimpan terpisah dari data pajak.");
    } catch (err) { setError(err instanceof Error ? err.message : "Save to Cloud Dashboard Finance gagal."); } finally { setBusy(false); }
  }
  function updateFinanceAccount(id: string, patch: Partial<FinanceAccount>) { setFinanceAccounts((rows) => rows.map((row) => row.id === id ? normalizeFinanceAccount({ ...row, ...patch }) : row)); }
  function addFinanceAccount(brand = "", destination?: FinanceStructureItem) {
    const selectedBrand = brand || "Obsidian";
    const selectedDestination = destination ?? DEFAULT_FINANCE_STRUCTURE[selectedBrand]?.[0];
    const account = normalizeFinanceAccount({ brand: selectedBrand, group: selectedDestination?.type === "group" ? selectedDestination.name : "Entity", entity: selectedDestination?.type === "entity" ? selectedDestination.name : selectedDestination?.name || "Entity Belum Diisi", accountName: "", provider: "", accountNumber: "", accountType: "Bank", balance: 0, source: "Manual Input" });
    setFinanceAccounts((rows) => [...rows, { ...account, accountName: "", provider: "", accountNumber: "", accountType: "Bank", balance: 0 }]);
    setMessage("Rekening finance ditambahkan. Klik Save to Cloud agar tersimpan.");
  }
  function deleteFinanceAccount(id: string) { if (!confirm("Hapus rekening finance ini?")) return; setFinanceAccounts((rows) => rows.filter((row) => row.id !== id)); }
  function importUpdateSaldoExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => { const password = await verifyPassword(); if (!password) { event.target.value = ""; return; } setBusy(true); setError(""); try { const rows = parseUpdateSaldoExcel(reader.result as ArrayBuffer); const mode = window.confirm("Replace existing finance data? Pilih Cancel untuk append.") ? "replace" : "append"; setFinanceAccounts((current) => mode === "replace" ? rows : [...current, ...rows]); setMessage(rows.length ? "Data saldo berhasil diupload" : "Excel Dashboard Finance kosong. KPI tetap Rp 0."); } catch (err) { setError(err instanceof Error ? err.message : "Format Excel update saldo tidak sesuai"); } finally { setBusy(false); event.target.value = ""; } };
    reader.readAsArrayBuffer(file);
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
    return { id: row.id, perusahaan: row.company, masaPajak: row.masa, tahun: normalizeYear(row.year || periodYear(row.masa)), jenisPajak: row.jenisPajak as TaxType, dpp: row.dpp, pajakTerhutang: row.pajakTerutang, ntpnNtpd: row.ntpnNtpd, status: row.status || displayStatus(statusAuto), statusAuto, keterangan: row.keterangan || "", ppnKeluaran: row.ppnKeluaran, ppnMasukan: row.ppnMasukan, pmTidakDikreditkan: row.pmTidakDikreditkan, totalPembayaranPpn: row.totalPembayaranPpn, sourceData: "Excel Import", sourceSheet: row.sourceSheet, sourceRow: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  useEffect(() => { const savedSaldo = localStorage.getItem(FINANCE_FILTER_STORAGE_KEY); if (savedSaldo) setFinanceFilters({ ...financeFilters, ...JSON.parse(savedSaldo) }); const saved = localStorage.getItem(FILTER_STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as Partial<Filters>; setFilters({ tahun: parsed.tahun === ALL ? ALL : normalizeYear(parsed.tahun), masaPajak: parsed.masaPajak && (parsed.masaPajak === ALL || monthIndex(parsed.masaPajak) >= 0) ? parsed.masaPajak : ALL, perusahaan: parsed.perusahaan ?? ALL, jenisPajak: parsed.jenisPajak ?? ALL, status: parsed.status ?? ALL, search: parsed.search ?? "" }); } refreshData(); }, []);
  useEffect(() => {
    const applyUrlPage = () => {
      const requestedPage = new URLSearchParams(window.location.search).get("page");
      if (requestedPage === "legalStructure") {
        const url = new URL(window.location.href);
        url.searchParams.set("page", "legalCompany");
        window.history.replaceState(null, "", url);
        setAccessDenied(!canAccessArea(user.role, "legal"));
        if (canAccessArea(user.role, "legal")) setPage("legalCompany");
        return;
      }
      if (!requestedPage || !(requestedPage in pageMeta)) return;
      const requested = requestedPage as Page;
      const allowed = canAccessArea(user.role, isLegalPage(requested) ? "legal" : isFinanceAreaPage(requested) ? "finance" : "tax");
      setAccessDenied(!allowed);
      if (allowed) setPage(requested);
    };
    applyUrlPage();
    window.addEventListener("popstate", applyUrlPage);
    return () => window.removeEventListener("popstate", applyUrlPage);
  }, [user.role]);
  useEffect(() => localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters)), [filters]);
  useEffect(() => localStorage.setItem(FINANCE_FILTER_STORAGE_KEY, JSON.stringify(financeFilters)), [financeFilters]);
  const baseRows = useMemo(() => pageMeta[page].types ? records.filter((r) => pageMeta[page].types?.includes(r.jenisPajak)) : records, [page, records]);
  const filtered = useMemo(() => baseRows.filter((r) => {
    const matchesTahun = filters.tahun === ALL || normalizeYear(r.tahun) === filters.tahun;
    const matchesMasaPajak = filters.masaPajak === ALL || matchesMonthFilter(r.masaPajak, filters.masaPajak);
    const matchesPerusahaan = filters.perusahaan === ALL || r.perusahaan === filters.perusahaan;
    const matchesJenisPajak = filters.jenisPajak === ALL || r.jenisPajak === filters.jenisPajak;
    const matchesStatus = page === "dashboard" || filters.status === ALL || r.status === filters.status;
    const matchesSearch = page === "dashboard" || !filters.search || `${r.perusahaan} ${r.ntpnNtpd} ${r.jenisPajak} ${r.keterangan}`.toLowerCase().includes(filters.search.toLowerCase());
    return matchesTahun && matchesMasaPajak && matchesPerusahaan && matchesJenisPajak && matchesStatus && matchesSearch;
  }), [baseRows, filters, page]);
  const options = (key: keyof TaxTransaction) => Array.from(new Set(records.map((r) => String(r[key] ?? "")))).filter(Boolean).sort((a, b) => key === "masaPajak" ? periodSort(a) - periodSort(b) : a.localeCompare(b));
  const yearOptions = Array.from(new Set([DEFAULT_DASHBOARD_YEAR, ...options("tahun").filter((year) => Number(year) >= 2026)]));
  const summaryRows = useMemo(() => filtered, [filtered]);
  const dashboardRows = useMemo(() => summaryRows, [summaryRows]);
  const meta = pageMeta[page];
  const financeScopedAccounts = useMemo(() => { const scopedBrand = isFinancePage(page) ? financeBrand(page) : ""; return financeAccounts.filter((r) => !scopedBrand || r.brand === scopedBrand); }, [financeAccounts, page]);
  const financeOptions = { group: Array.from(new Set(financeAccounts.map((r) => r.group))).filter(Boolean).sort() };

  function navigateToPage(nextPage: Page) {
    const allowed = canAccessArea(user.role, isLegalPage(nextPage) ? "legal" : isFinanceAreaPage(nextPage) ? "finance" : "tax");
    setAccessDenied(!allowed);
    const url = new URL(window.location.href);
    url.searchParams.set("page", nextPage);
    window.history.pushState(null, "", url);
    if (allowed) setPage(nextPage);
  }

  function updateFilter(key: keyof Filters, value: string) { setFilters((cur) => ({ ...cur, [key]: value })); }
  function openManual(entry?: TaxTransaction) { setFormErrors({}); setForm(entry ? { ...emptyManualForm(page), id: entry.id, perusahaan: entry.perusahaan, tahun: entry.tahun, masaPajak: entry.masaPajak, jenisPajak: entry.jenisPajak, dpp: String(entry.dpp), pajak: String(entry.pajakTerhutang), ntpnNtpd: entry.ntpnNtpd, tanggalBayar: normalizePaymentDate(entry.tanggalBayar), status: entry.status, keterangan: entry.keterangan, ppnKeluaran: entry.jenisPajak === "PPN" ? String(entry.ppnKeluaran ?? entry.dpp) : "", ppnMasukan: entry.jenisPajak === "PPN" ? String(entry.ppnMasukan ?? "") : "", pmTidakDikreditkan: entry.jenisPajak === "PPN" ? String(entry.pmTidakDikreditkan ?? "") : "", totalPembayaranPpn: entry.jenisPajak === "PPN" ? String(entry.totalPembayaranPpn ?? "") : "" } : emptyManualForm(page)); setModalOpen(true); }
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
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setError("Format file harus Excel .xlsx"); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const password = await verifyPassword(); if (!password) { event.target.value = ""; return; }
      setBusy(true); setMessage("Memproses Excel...");
      try {
        if (!["ppn", "pph21", "unifikasi", "pb1", "umkm"].includes(page)) throw new Error("Upload Excel tidak tersedia di halaman ini.");
        const parsed = parsePageTaxWorkbook(reader.result as ArrayBuffer, page as UploadTaxPage);
        const rows = parsed.map(mapTaxRecord);
        if (!rows.length) throw new Error("Format Excel tidak sesuai. Pastikan baris pertama berisi header kolom.");
        setRecords((current) => [...current, ...rows]);
        setUploadBatches((current) => [{ id: `upload-${crypto.randomUUID()}`, file_name: file.name, uploaded_at: new Date().toISOString(), total_rows: rows.length, uploaded_by: "verified-user", status: "success", error_message: "" }, ...current]);
        setMessage("Data Excel berhasil diupload");
      } catch (err) { console.error("[tax-dashboard] Gagal memproses upload Excel", err); setError(err instanceof Error ? err.message : "Data Excel gagal diproses."); } finally { setBusy(false); event.target.value = ""; }
    };
    reader.readAsArrayBuffer(file);
  }

  return <main className="min-h-screen bg-[#EEF3F8] text-slate-950" style={{ fontFamily: PROFESSIONAL_FONT_STACK }}>
    <Sidebar page={page} setPage={navigateToPage} open={drawerOpen} setOpen={setDrawerOpen} user={user} onLogout={onLogout} />
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 border-b border-[#D8E0EA] bg-[#EEF3F8]/90 px-4 py-3 backdrop-blur lg:hidden"><Button variant="outline" onClick={() => setDrawerOpen(true)}><Menu className="h-4 w-4" /> Menu</Button></header>
      {accessDenied ? <AccessDenied onBack={() => navigateToPage(user.role === "FINANCE_USER" ? "financeOverview" : "dashboard")} /> : isLegalPage(page) ? <LegalDocumentDashboard page={page} verifyPassword={verifyPassword} /> : <section className="space-y-6 p-4 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>{meta.subtitle && <p className="mt-2 text-base font-medium text-slate-600">{meta.subtitle}</p>}</div>{isManualPage(page) && page !== "dashboard" && page !== "controlOmzet" && <Button onClick={() => openManual()} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> {manualButtonLabel(page)}</Button>}</div>
        {page === "controlOmzet" || isCashflowPage(page) ? null : isFinancePage(page) ? <FinanceActionBar filters={financeFilters} setFilters={setFinanceFilters} options={financeOptions} activeTab={financeTabFromPage(page)} setPage={navigateToPage} onQuickUpdate={() => setQuickSaldoOpen(true)} onSave={saveUpdateSaldoToCloud} saving={busy} /> : <FilterBar filters={filters} updateFilter={updateFilter} options={{ tahun: yearOptions, masaPajak: MONTH_NAMES, perusahaan: options("perusahaan"), jenisPajak: page === "dashboard" ? DASHBOARD_FILTER_TAX_TYPES : TAX_TYPES.filter((type) => !meta.types || meta.types.includes(type)), status: FILTER_STATUSES }} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} onSave={saveToCloud} saving={busy} showDataEntryActions={page !== "dashboard" && page !== "documents" && !isFinanceAreaPage(page)} showStatusAndSearch={page !== "documents" && page !== "dashboard" && !isFinanceAreaPage(page)} />}
        <Input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
        <Input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" onChange={uploadPdf} className="hidden" />
        <Input ref={updateSaldoInputRef} type="file" accept=".xlsx,.xls" onChange={importUpdateSaldoExcel} className="hidden" />
        {page !== "controlOmzet" && !isCashflowPage(page) && <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />{loading ? "Memuat data pajak..." : message}{!records.length && !loading && " KPI akan menampilkan 0 sampai data tersedia."}{lastSaved && <span className="ml-2 text-slate-500">Last saved: {new Date(lastSaved).toLocaleString("id-ID")}</span>}</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {page === "controlOmzet" ? <ControlOmzetDashboard data={controlOmzetData} setData={setControlOmzetData} saving={busy} onSave={saveControlOmzetToCloud} /> : isCashflowPage(page) ? <CashflowDashboard page={page} verifyPassword={verifyPassword} /> : isFinancePage(page) ? <FinanceDashboard page={page as FinancePage} accounts={financeScopedAccounts} allAccounts={financeAccounts} devices={financeDevices} setDevices={setFinanceDevices} filters={financeFilters} lastSaved={financeLastSaved} onAddAccount={addFinanceAccount} onUpdateAccount={updateFinanceAccount} onDeleteAccount={deleteFinanceAccount} /> : page === "documents" ? <Documents documents={pdfDocuments} uploading={pdfUploading} onUpload={() => pdfInputRef.current?.click()} /> : page === "dashboard" ? <DashboardOverview rows={dashboardRows} documentCount={pdfDocuments.length} /> : <><KpiGrid items={buildKpis(page, summaryRows, summaryOverrides)} onEdit={async (label, value) => { const password = await verifyPassword(); if (!password) return; const input = window.prompt(`Edit nominal ${label}`, String(value)); if (input === null) return; if (input === "") { setSummaryOverrides((cur) => { const next = { ...cur }; delete next[label]; return next; }); } else { setSummaryOverrides((cur) => ({ ...cur, [label]: numberValue(input) })); } setMessage("Override summary diubah. Klik Save to Cloud untuk persist."); }} /><TransactionTable rows={summaryRows} title={`Tabel detail ${meta.title}`} isDashboard={false} onEdit={openManual} onDelete={deleteManual} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} hideTaxType={page === "ppn"} showPpnPayment={page === "ppn"} /></>}
      </section>}
    </div>
    {modalOpen && <ManualModal page={page} form={form} setForm={setForm} errors={formErrors} onClose={() => setModalOpen(false)} onSave={saveManual} saving={busy} />}
    {quickSaldoOpen && <QuickSaldoModal accounts={financeAccounts} onClose={() => setQuickSaldoOpen(false)} onSave={(updates) => { setFinanceAccounts((rows) => rows.map((row) => updates[row.id] ? normalizeFinanceAccount({ ...row, balance: updates[row.id].balance, notes: updates[row.id].notes }) : row)); setMessage("Quick Update Saldo Hari Ini berhasil. Klik Save to Cloud agar tersimpan."); setQuickSaldoOpen(false); }} />}
  </main>;
}

function QuickSaldoModal({ accounts, onClose, onSave }: { accounts: FinanceAccount[]; onClose: () => void; onSave: (updates: Record<string, { balance: number; notes: string }>) => void }) {
  const [rows, setRows] = useState(() => accounts.map((account) => ({ id: account.id, balance: String(account.balance ?? 0), notes: "" })));
  const update = (id: string, patch: Partial<{ balance: string; notes: string }>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const save = () => onSave(Object.fromEntries(rows.map((row) => [row.id, { balance: row.balance === "" ? 0 : parseNumber(row.balance), notes: row.notes }])));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 p-5">
        <h2 className="text-xl font-black text-slate-950">Quick Update Saldo Hari Ini</h2>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {accounts.length ? <Table>
          <TableHeader className="sticky top-0 z-10 bg-white shadow-sm"><TableRow>{["Brand", "Account", "Provider", "Code", "Current Balance", "New Balance", "Notes"].map((h) => <TableHead key={h} className="whitespace-nowrap text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{accounts.map((account) => {
            const draft = rows.find((row) => row.id === account.id) ?? { balance: String(account.balance ?? 0), notes: "" };
            return <TableRow key={account.id}>
              <TableCell className="min-w-28 font-bold">{account.brand}</TableCell>
              <TableCell className="min-w-48 font-semibold">{account.accountName}</TableCell>
              <TableCell className="min-w-36">{account.provider || "-"}</TableCell>
              <TableCell className="min-w-36">{account.accountNumber || "-"}</TableCell>
              <TableCell className="min-w-40 font-bold">{rupiah(account.balance ?? 0)}</TableCell>
              <TableCell><Input value={draft.balance} onChange={(e) => update(account.id, { balance: e.target.value })} className="min-w-40 rounded-xl" /></TableCell>
              <TableCell><Input value={draft.notes} onChange={(e) => update(account.id, { notes: e.target.value })} placeholder="Catatan" className="min-w-56 rounded-xl" /></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table> : <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">Belum ada data saldo</div>}
      </div>
      <div className="border-t border-slate-200 p-5"><Button onClick={save} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700">Save</Button></div>
    </div>
  </div>;
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return <section className="grid min-h-screen place-items-center p-6"><div className="max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldX className="h-8 w-8" /></div><h1 className="text-3xl font-black text-slate-950">Akses Ditolak</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Anda tidak memiliki hak akses untuk membuka dashboard ini.</p><Button onClick={onBack} className="mt-6 rounded-2xl bg-blue-600 font-bold hover:bg-blue-700">Kembali ke dashboard</Button></div></section>;
}

function Sidebar({ page, setPage, open, setOpen, user, onLogout }: { page: Page; setPage: (page: Page) => void; open: boolean; setOpen: (open: boolean) => void; user: { email: string; role: UserRole }; onLogout: () => void }) {
  const [taxExpanded, setTaxExpanded] = useState(() => taxSubmenuItems.some(([id]) => id === page));
  const [financeExpanded, setFinanceExpanded] = useState(() => financeSubmenuItems.some(([id]) => id === page));
  const [cashflowExpanded, setCashflowExpanded] = useState(() => page === "cashflowProjection" || page === "cashflowActual");
  const [legalExpanded, setLegalExpanded] = useState(() => isLegalPage(page));

  useEffect(() => {
    if (taxSubmenuItems.some(([id]) => id === page)) setTaxExpanded(true);
    if (financeSubmenuItems.some(([id]) => id === page)) setFinanceExpanded(true);
    if (page === "cashflowProjection" || page === "cashflowActual") setCashflowExpanded(true);
    if (isLegalPage(page)) setLegalExpanded(true);
  }, [page]);

  const navigate = (id: Page) => { setPage(id); setOpen(false); };
  const submenuItem = (id: Page, Icon: typeof Home, label: string) => <button key={id} onClick={() => navigate(id)} className={cn("flex w-full items-center gap-3 rounded-2xl py-2.5 pl-12 pr-4 text-left text-sm font-semibold transition", page === id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5 shrink-0" />{label}</button>;
  const parentItem = (id: Page | null, Icon: typeof Home, label: string, expanded: boolean, toggle: () => void) => <button onClick={() => { if (id) setPage(id); toggle(); }} aria-expanded={expanded} className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition", id && page === id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5 shrink-0" /><span className="flex-1">{label}</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} /></button>;
  return <aside className={cn("fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto bg-[#020617] p-5 text-white shadow-2xl transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="relative mb-5 flex justify-center"><div className="flex w-full flex-col items-center"><p className="mb-3 rounded-full border border-blue-400/40 bg-blue-500/15 px-4 py-1.5 text-center text-[11px] font-extrabold tracking-wide text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.18)]">TAX, FINANCE &amp; LEGAL</p><img src="data:image/jpeg;base64,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" alt="OMG - Obsidian Management Group" className="h-auto w-36 rounded-xl object-contain" /></div><Button variant="ghost" size="icon" className="absolute right-0 top-0 text-white lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button></div>
    <nav className="space-y-7">
      {canAccessArea(user.role, "tax") && <div><p className="mb-3 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-200 shadow-sm">Dashboard Tax</p><div className="space-y-1.5">{parentItem("dashboard", Home, "Overview", taxExpanded, () => setTaxExpanded((value) => !value))}{taxExpanded && <div className="space-y-1">{taxSubmenuItems.map(([id, Icon, label]) => submenuItem(id, Icon, label))}</div>}<button onClick={() => navigate("controlOmzet")} className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition", page === "controlOmzet" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white")}><TrendingUp className="h-5 w-5 shrink-0" />Control Omzet</button></div></div>}
      {canAccessArea(user.role, "finance") && <div><p className="mb-3 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-200 shadow-sm">Dashboard Finance</p><div className="space-y-1.5">{parentItem("financeOverview", WalletCards, "Saldo Kas/Bank", financeExpanded, () => setFinanceExpanded((value) => !value))}{financeExpanded && <div className="space-y-1">{financeSubmenuItems.map(([id, Icon, label]) => submenuItem(id, Icon, label))}</div>}{parentItem("cashflow", TrendingDown, "Cashflow", cashflowExpanded, () => setCashflowExpanded((value) => !value))}{cashflowExpanded && <div className="space-y-1">{submenuItem("cashflowProjection", CalendarDays, "Proyeksi")}{submenuItem("cashflowActual", CheckCircle2, "Realisasi")}</div>}</div></div>}
      {canAccessArea(user.role, "legal") && <div><p className="mb-3 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-200 shadow-sm">Dashboard Legal</p><div className="space-y-1.5">{parentItem(null, Gavel, "Legal Document", legalExpanded, () => setLegalExpanded((value) => !value))}{legalExpanded && <div className="space-y-1">{submenuItem("legalCompany", Building2, "Company Profile")}{submenuItem("legalDocuments", FileText, "Document")}</div>}</div></div>}
    </nav>
    <div className="mt-8 border-t border-white/10 pt-5"><p className="truncate px-4 text-sm font-bold text-white">{user.email}</p><p className="mt-1 px-4 text-xs font-semibold text-slate-400">{user.role.replaceAll("_", " ")}</p><Button onClick={onLogout} variant="ghost" className="mt-3 w-full justify-start rounded-2xl px-4 font-bold text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Logout</Button></div>
  </aside>;
}
function FilterBar({ filters, updateFilter, options, onUpload, onManual, onSave, saving, showDataEntryActions = true, showStatusAndSearch = true }: { filters: Filters; updateFilter: (key: keyof Filters, value: string) => void; options: { tahun: readonly string[]; masaPajak: readonly string[]; perusahaan: readonly string[]; jenisPajak: readonly string[]; status: readonly string[] }; onUpload: () => void; onManual: () => void; onSave: () => void; saving: boolean; showDataEntryActions?: boolean; showStatusAndSearch?: boolean }) {
  const selects: [keyof Filters, string, readonly string[]][] = [["tahun", "Semua Tahun", options.tahun], ["masaPajak", "Semua Masa Pajak", options.masaPajak], ["perusahaan", "Semua Perusahaan", options.perusahaan], ["jenisPajak", "Semua Jenis Pajak", options.jenisPajak], ...(showStatusAndSearch ? ([["status", "Semua Status", options.status]] as [keyof Filters, string, readonly string[]][]) : [])];
  return <Card className="rounded-3xl border-[#D8E0EA] shadow-sm"><CardContent className="flex flex-wrap items-center gap-3 p-4">{selects.map(([key, placeholder, values]) => <Select key={key} value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)} className="h-11 min-w-0 flex-1 basis-full rounded-2xl bg-white sm:basis-[calc(50%-0.75rem)] lg:basis-44"><option value={ALL}>{placeholder}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}</Select>)}<div className="flex w-full flex-wrap gap-3 sm:w-auto sm:flex-nowrap">{showDataEntryActions && <><Button onClick={onUpload} className="h-11 flex-1 rounded-2xl bg-blue-600 font-bold hover:bg-blue-700 sm:flex-none"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="h-11 flex-1 rounded-2xl font-bold sm:flex-none"><Plus className="h-4 w-4" /> Manual</Button></>}<Button onClick={onSave} disabled={saving} variant="outline" className="h-11 flex-1 rounded-2xl font-bold sm:flex-none">Save to Cloud</Button></div></CardContent></Card>;
}
function buildKpis(page: Page, rows: TaxTransaction[], _overrides: SummaryOverrides = {}): KpiItem[] {
  void _overrides;
  if (page === "ppn") return [{ label: "Total PPN Keluaran", value: ppnOutput(rows), money: true }, { label: "Total PPN Masukan", value: ppnInput(rows), money: true }, { label: "PM Tidak Dikreditkan", value: ppnNonCreditable(rows), money: true }, { label: "Kurang Bayar/Lebih Bayar", value: ppnBalance(rows), money: true }, { label: "Total Pembayaran PPN", value: ppnPayment(rows), money: true }];
  if (page === "pph21") return [{ label: "Total DPP PPh 21", value: dpp(rows), money: true }, { label: "Total PPh 21", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "unifikasi") return [{ label: "Total DPP", value: dpp(rows), money: true }, { label: "Total PPh 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total pembayaran", value: sum(rows), money: true }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "pb1") return [{ label: "Total DPP PB1", value: dpp(rows), money: true }, { label: "Total PB1", value: sum(rows), money: true }, { label: "Jumlah NTPD", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPD kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "umkm") return [{ label: "Total DPP UMKM", value: dpp(rows), money: true }, { label: "Total PPh UMKM", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  return [{ label: "Total PPN Keluaran", value: ppnOutput(rows), money: true }, { label: "Total PPN Masukan", value: ppnInput(rows), money: true }, { label: "Total PM Tidak Dikreditkan", value: ppnNonCreditable(rows), money: true }, { label: "Total Pembayaran PPN", value: ppnPayment(rows), money: true }, { label: "Total PPh Pasal 21", value: sum(rows, "PPh Pasal 21"), money: true }, { label: "Total PPh Pasal 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total PB1", value: sum(rows, "PB1"), money: true }, { label: "Total PPh UMKM", value: sum(rows, "PPh UMKM"), money: true }, { label: "Total seluruh pembayaran pajak", value: totalTaxPayments(rows), money: true }, { label: "Jumlah perusahaan", value: new Set(rows.map((r) => r.perusahaan)).size }, { label: "Jumlah masa pajak", value: new Set(rows.map((r) => r.masaPajak)).size }, { label: "Jumlah NTPN/NTPD terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "Belum memiliki NTPN/NTPD", value: rows.filter((r) => !r.ntpnNtpd).length }];
}

const DASHBOARD_COLORS: Record<DashboardTaxKind, string> = { PPN: "#2563eb", "PPh Pasal 21": "#16a34a", "PPh Unifikasi": "#f97316", PB1: "#dc2626", UMKM: "#7c3aed" };
const DASHBOARD_KINDS: DashboardTaxKind[] = ["PPN", "PPh Pasal 21", "PPh Unifikasi", "PB1", "UMKM"];
type TaxTypeSummary = { name: DashboardTaxKind; value: number; paid: number; balance: number; totalRows: number; verifiedRows: number; reviewRows: number; status: "Terverifikasi" | "Perlu Review" | "Belum Lengkap" };
type DashboardSummary = { totalTax: number; totalPaid: number; balance: number; uniquePeriods: number; documentCount: number; verifiedCount: number; totalRows: number; reviewCount: number };

function taxAmount(row?: TaxTransaction) { return numberValue(row?.pajakTerhutang); }
function rowHasRequiredData(row: TaxTransaction) { return Boolean(clean(row.perusahaan) && clean(row.masaPajak) && clean(row.jenisPajak)); }
function isVerifiedOrPaid(row: TaxTransaction) {
  const statusText = `${row.status ?? ""} ${row.statusAuto ?? ""}`.toLowerCase();
  return Boolean(clean(row.ntpnNtpd)) || /terverifikasi|sudah\s+ada\s+ntpn|sudah\s+ada\s+ntpd|dibayar|terbayar|verified|paid/.test(statusText);
}
function dashboardTaxTotal(name: DashboardTaxKind, rows: TaxTransaction[]) {
  if (name === "PPN") return ppnBalance(rows);
  if (name === "PPh Pasal 21") return sum(rows, "PPh Pasal 21");
  if (name === "PPh Unifikasi") return sum(rows, "PPh Pasal 23") + sum(rows, "PPh Final 4(2)");
  if (name === "PB1") return sum(rows, "PB1");
  return sum(rows, "PPh UMKM");
}
function dashboardPaidTotal(name: DashboardTaxKind, rows: TaxTransaction[]) {
  if (name === "PPN") return ppnPayment(rows);
  return rows.filter(isVerifiedOrPaid).reduce((acc, row) => acc + taxAmount(row), 0);
}
function getTaxTypeSummary(rows: TaxTransaction[] = []): TaxTypeSummary[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  return DASHBOARD_KINDS.map((name) => {
    const typeRows = safeRows.filter((row) => dashboardKind(row.jenisPajak) === name);
    const value = dashboardTaxTotal(name, typeRows);
    const paid = dashboardPaidTotal(name, typeRows);
    const verifiedRows = typeRows.filter(isVerifiedOrPaid).length;
    const reviewRows = Math.max(typeRows.length - verifiedRows, 0);
    const hasIncompleteData = typeRows.some((row) => !rowHasRequiredData(row));
    const status = !typeRows.length || hasIncompleteData ? "Belum Lengkap" : reviewRows > 0 ? "Perlu Review" : "Terverifikasi";
    return { name, value, paid, balance: value - paid, totalRows: typeRows.length, verifiedRows, reviewRows, status };
  });
}
function getDashboardSummary(rows: TaxTransaction[] = [], documentCount = 0): DashboardSummary {
  const safeRows = Array.isArray(rows) ? rows : [];
  const typeSummary = getTaxTypeSummary(safeRows);
  const verifiedCount = safeRows.filter(isVerifiedOrPaid).length;
  return {
    totalTax: typeSummary.reduce((acc, item) => acc + item.value, 0),
    totalPaid: typeSummary.reduce((acc, item) => acc + item.paid, 0),
    balance: typeSummary.reduce((acc, item) => acc + item.balance, 0),
    uniquePeriods: new Set(safeRows.map((row) => clean(row.masaPajak)).filter(Boolean)).size,
    documentCount: numberValue(documentCount),
    verifiedCount,
    totalRows: safeRows.length,
    reviewCount: Math.max(safeRows.length - verifiedCount, 0),
  };
}
function getTaxCompositionData(rows: TaxTransaction[] = []) { return getTaxTypeSummary(rows).filter((item) => item.value > 0).map(({ name, value }) => ({ name, value })); }
function DashboardOverview({ rows, documentCount }: { rows?: TaxTransaction[]; documentCount?: number }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const summary = getDashboardSummary(safeRows, documentCount);
  const taxByKind = getTaxTypeSummary(safeRows);
  const donutData = getTaxCompositionData(safeRows);
  const chartData = taxByKind;
  const kpis = [
    { label: "Total Pajak Terutang", value: rupiah(summary.totalTax), icon: WalletCards, tone: "bg-blue-50 text-blue-700" },
    { label: "Total Pajak Dibayar", value: rupiah(summary.totalPaid), icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Kurang Bayar / Lebih Bayar", value: rupiah(summary.balance), icon: summary.balance >= 0 ? TrendingUp : TrendingDown, tone: summary.balance >= 0 ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700" },
    { label: "Jumlah Masa Pajak", value: plainNumber(summary.uniquePeriods), icon: FileSpreadsheet, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Dokumen Pajak", value: plainNumber(summary.documentCount), icon: FileArchive, tone: "bg-purple-50 text-purple-700" },
    { label: "Status Verifikasi", value: `${plainNumber(summary.verifiedCount)} / ${plainNumber(summary.totalRows)}`, icon: CheckCircle2, tone: "bg-slate-100 text-slate-700", helper: summary.reviewCount ? `${plainNumber(summary.reviewCount)} perlu review` : "Semua data terverifikasi" },
  ];
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{kpis.map(({ label, value, icon: Icon, tone, helper }) => <Card key={label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></div><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-400">YTD</span></div><p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p>{helper && <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>}</CardContent></Card>)}</section>
    <section className="grid gap-6 xl:grid-cols-5"><Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm xl:col-span-2"><CardHeader><CardTitle>Komposisi Pajak</CardTitle><CardDescription>Distribusi nilai pajak berdasarkan jenis utama.</CardDescription></CardHeader><CardContent className="relative h-80"><ResponsiveContainer width="100%" height="100%"><PieChart>{donutData.length ? <Pie data={donutData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="78%" paddingAngle={3}>{donutData.map((entry) => <Cell key={entry.name} fill={DASHBOARD_COLORS[entry.name]} />)}</Pie> : <Pie data={[{ name: "Belum ada data", value: 1 }]} dataKey="value" innerRadius="58%" outerRadius="78%"><Cell fill="#e2e8f0" /></Pie>}<Tooltip formatter={(value: number) => rupiah(value)} /><Legend layout="vertical" align="right" verticalAlign="middle" /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center pr-28"><div className="text-center"><p className="text-xs font-bold uppercase text-slate-400">Total</p><p className="text-lg font-black text-slate-950">{rupiah(summary.totalTax)}</p></div></div></CardContent></Card><Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm xl:col-span-3"><CardHeader><CardTitle>Pajak per Jenis Pajak</CardTitle><CardDescription>Perbandingan pajak terutang dan sudah dibayar.</CardDescription></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={(value: number) => `${Math.round(value / 1000000)} jt`} width={54} /><Tooltip formatter={(value: number) => rupiah(value)} /><Legend /><Bar dataKey="value" name="Total Pajak" radius={[8, 8, 0, 0]} fill="#2563eb" /><Bar dataKey="paid" name="Sudah Dibayar" radius={[8, 8, 0, 0]} fill="#16a34a" /></BarChart></ResponsiveContainer></CardContent></Card></section>
    <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Ringkasan Pajak per Jenis</CardTitle><CardDescription>Status ringkas untuk kebutuhan review management.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Jenis Pajak", "Total Pajak", "Sudah Dibayar", "KB/LB", "Status"].map((head) => <TableHead key={head} className="text-xs uppercase text-slate-500">{head}</TableHead>)}</TableRow></TableHeader><TableBody>{chartData.length ? chartData.map((item) => <TableRow key={item.name} className="hover:bg-slate-50"><TableCell className="font-bold"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DASHBOARD_COLORS[item.name] }} />{item.name}</TableCell><TableCell>{rupiah(item.value)}</TableCell><TableCell>{rupiah(item.paid)}</TableCell><TableCell className={item.balance > 0 ? "font-bold text-orange-600" : "font-bold text-emerald-600"}>{rupiah(item.balance)}</TableCell><TableCell><Badge variant={item.status === "Terverifikasi" ? "success" : item.status === "Perlu Review" ? "warning" : "secondary"}>{item.status}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm font-semibold text-slate-500">Belum ada data sesuai filter.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>;
}

function KpiGrid({ items, onEdit }: { items: KpiItem[]; onEdit: (label: string, value: number) => void }) { return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</p>{item.money && <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit nominal / kosongkan input untuk Reset override" onClick={() => onEdit(item.label, item.value)}><Edit3 className="h-3.5 w-3.5" /></Button>}</div><p className="mt-3 text-2xl font-black text-slate-950">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p></CardContent></Card>)}</section>; }
function TransactionTable({ title, rows, isDashboard, onEdit, onDelete, onUpload, onManual, hideTaxType = false, showPpnPayment = false }: { title: string; rows: TaxTransaction[]; isDashboard: boolean; onEdit: (row: TaxTransaction) => void; onDelete: (id: string) => void; onUpload: () => void; onManual: () => void; hideTaxType?: boolean; showPpnPayment?: boolean }) {
  const headers = isDashboard ? ["Perusahaan", "Masa Pajak", "Jenis Pajak", "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Keterangan", "Aksi"] : ["Perusahaan", "Masa Pajak", ...(hideTaxType ? [] : ["Jenis Pajak"]), "DPP", "Pajak Terhutang", ...(showPpnPayment ? ["Total Pembayaran PPN"] : []), "NTPN/NTPD", "Status", "Source", "Hapus"];
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{rows.length} baris data.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((r) => <TableRow key={r.id} className="hover:bg-slate-50"><TableCell className="min-w-56 font-semibold">{r.perusahaan}</TableCell><TableCell>{r.masaPajak}</TableCell>{!hideTaxType && <TableCell>{r.jenisPajak}</TableCell>}<TableCell>{rupiah(r.dpp)}</TableCell><TableCell className={r.pajakTerhutang < 0 ? "font-bold text-red-600" : ""}>{rupiah(r.pajakTerhutang)}</TableCell>{showPpnPayment && <TableCell>{rupiah(ppnPaymentValue(r))}</TableCell>}<TableCell>{r.ntpnNtpd || "-"}</TableCell><TableCell><Badge variant={statusTone(r.status)}>{r.status === "Terverifikasi" && <CheckCircle2 className="mr-1 h-3 w-3" />}{r.status}</Badge><div className="mt-1 text-[11px] font-semibold text-slate-400">{r.statusAuto}</div></TableCell><TableCell><Badge variant={r.sourceData === "Manual Input" ? "success" : "secondary"}>{r.sourceData || "Excel Import"}</Badge></TableCell>{!isDashboard && <TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></TableCell>}{isDashboard && <><TableCell className="min-w-72">{r.keterangan || `${r.sourceSheet} baris ${r.sourceRow}`}</TableCell><TableCell>{r.sourceData === "Manual Input" ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(r)}><Edit3 className="h-3 w-3" /> Edit</Button><Button size="sm" variant="outline" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div> : <Badge variant="secondary">Excel Import</Badge>}</TableCell></>}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-36 text-center text-sm font-semibold text-slate-500"><div className="space-y-4"><p>{isDashboard ? "Belum ada data manual." : "Belum ada data. Upload Excel atau tambahkan data manual."}</p><div className="flex justify-center gap-3">{!isDashboard && <><Button onClick={onUpload} className="rounded-2xl bg-blue-600"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="rounded-2xl"><Plus className="h-4 w-4" /> Tambah Data Manual</Button></>}</div></div></TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}
function ManualModal({ page, form, setForm, errors, onClose, onSave, saving }: { page: Page; form: ManualForm; setForm: (form: ManualForm) => void; errors: Record<string, string>; onClose: () => void; onSave: () => void; saving: boolean }) {
  const set = (key: keyof ManualForm, value: string) => setForm({ ...form, [key]: value });
  const ppnComputed = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan);
  const taxOptions = page === "ppn" ? ["PPN"] : page === "pb1" ? ["PB1"] : page === "dashboard" ? ["PPN", ...PPH_TYPES, "PB1"] : PPH_TYPES;
  const field = (key: keyof ManualForm, label: string, type = "text", placeholder = "") => <div><label className="text-xs font-extrabold uppercase text-slate-500">{label}</label><Input type={type} value={type === "date" ? toDateInputValue(form[key]) : String(form[key] ?? "")} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} min={type === "date" ? PAYMENT_DATE_MIN : undefined} max={type === "date" ? PAYMENT_DATE_MAX : undefined} className="mt-1 h-11 rounded-2xl" />{errors[key] && <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p>}</div>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-black">{form.id ? "Edit Data Pajak Manual" : manualButtonLabel(page)}</h2><p className="text-sm font-medium text-slate-500">Source Data dan Source Sheet otomatis disimpan sebagai Manual Input.</p><p className="mt-2 rounded-2xl bg-blue-50 p-3 text-xs font-semibold text-blue-700">Tanpa database, data manual hanya tersimpan di browser ini. Source Data dan Source Sheet tetap disimpan sebagai informasi internal saat data diekspor oleh admin.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="grid gap-4 md:grid-cols-2">{field("perusahaan", "Perusahaan")}{field("tahun", "Tahun")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Masa Pajak</label><Select value={form.masaPajak} onChange={(e) => set("masaPajak", e.target.value)} className="mt-1 h-11 rounded-2xl"><option value="">Pilih Masa Pajak</option>{MONTH_NAMES.map((month) => <option key={month} value={month}>{month}</option>)}</Select>{errors.masaPajak && <p className="mt-1 text-xs font-semibold text-red-600">{errors.masaPajak}</p>}</div><div><label className="text-xs font-extrabold uppercase text-slate-500">Jenis Pajak</label><Select value={form.jenisPajak} onChange={(e) => set("jenisPajak", e.target.value)} className="mt-1 h-11 rounded-2xl">{taxOptions.map((t) => <option key={t} value={t}>{t}</option>)}</Select>{errors.jenisPajak && <p className="mt-1 text-xs font-semibold text-red-600">{errors.jenisPajak}</p>}</div>{form.jenisPajak === "PPN" ? <>{field("ppnKeluaran", "PPN Keluaran")}{field("ppnMasukan", "PPN Masukan")}{field("pmTidakDikreditkan", "PM Tidak Dikreditkan")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Kurang Bayar / Lebih Bayar</label><Input value={rupiah(ppnComputed)} readOnly className="mt-1 h-11 rounded-2xl bg-slate-50" /></div>{field("totalPembayaranPpn", "Total Pembayaran PPN")}</> : <>{field("dpp", form.jenisPajak === "PB1" ? "DPP PB 1" : "DPP")}{field("pajak", form.jenisPajak === "PB1" ? "Nilai PB 1" : "Nilai Pajak / Pajak Terutang")}</>}{field("ntpnNtpd", form.jenisPajak === "PB1" ? "NTPD" : "NTPN/NTPD")}{field("tanggalBayar", "Tanggal Bayar", "date")}<div><label className="text-xs font-extrabold uppercase text-slate-500">Status Manual (opsional)</label><Select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 h-11 rounded-2xl"><option value="">Gunakan status otomatis</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select></div><div className="md:col-span-2">{field("keterangan", "Keterangan")}</div></div><div className="mt-6 flex justify-end gap-3"><Button variant="outline" className="rounded-2xl" onClick={onClose}>Batal</Button><Button className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700" onClick={onSave} disabled={saving}>{saving ? "Menyimpan..." : form.id ? "Simpan Perubahan" : "Simpan"}</Button></div></div></div>;
}
function UploadHistory({ batches, onDelete }: { batches: UploadBatch[]; onDelete: (id: string) => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Riwayat Upload Excel</CardTitle><CardDescription>{batches.length ? `${batches.length} batch upload dari file statis/sesi browser.` : "Belum ada upload Excel yang tersimpan di file statis."}</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Nama File", "Tanggal Upload", "Jumlah Baris", "Status", "Error", "Aksi"].map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{batches.length ? batches.map((b) => <TableRow key={b.id}><TableCell className="font-semibold">{b.file_name}</TableCell><TableCell>{new Date(b.uploaded_at).toLocaleString("id-ID")}</TableCell><TableCell>{plainNumber(b.total_rows)}</TableCell><TableCell><Badge variant={b.status === "success" ? "success" : "warning"}>{b.status}</Badge></TableCell><TableCell className="max-w-md truncate">{b.error_message || "-"}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => onDelete(b.id)}><Trash2 className="h-3 w-3" /> Hapus Data Upload Ini</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-20 text-center text-sm font-semibold text-slate-500">Belum ada upload Excel yang tersimpan di file statis. Upload di browser akan tampil sementara di sini dan bisa diekspor ke upload-history.json.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}

function FinanceActionBar({ filters, setFilters, options, activeTab, setPage, onQuickUpdate, onSave, saving }: { filters: FinanceFilters; setFilters: (filters: FinanceFilters) => void; options: { group: string[] }; activeTab: FinanceTab; setPage: (page: Page) => void; onQuickUpdate: () => void; onSave: () => void; saving: boolean }) {
  const set = (key: keyof FinanceFilters, value: string) => setFilters({ ...filters, [key]: value });
  const tabs: [FinanceTab, Page, string][] = [["overview", "financeOverview", "Saldo Kas/Bank"], ["details", "financeDetails", "Brand Details"], ["devices", "financeDevices", "Device Status"]];
  return <Card className="rounded-3xl border-[#D8E0EA] shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex flex-wrap gap-2">{tabs.map(([tab, target, label]) => <Button key={tab} variant={activeTab === tab ? "default" : "outline"} onClick={() => setPage(target)} className={cn("rounded-2xl font-bold", activeTab === tab && "bg-blue-600 hover:bg-blue-700")}>{label}</Button>)}</div><div className="flex flex-wrap items-center gap-3"><Input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Search brand/account/provider/code" className="h-11 flex-1 basis-full rounded-2xl bg-white lg:basis-72" /><Select value={filters.group} onChange={(e) => set("group", e.target.value)} className="h-11 flex-1 basis-40 rounded-2xl bg-white"><option value={ALL}>Semua kategori/group</option>{options.group.map((v) => <option key={v} value={v}>{v}</option>)}</Select><Select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className="h-11 flex-1 basis-40 rounded-2xl bg-white"><option value="structure">Urutan struktur</option><option value="balance">Saldo terbesar</option><option value="name">Nama A-Z</option></Select><Button onClick={() => alert("Struktur brand default: Obsidian, 1001, Resto.")} variant="outline" className="h-11 rounded-2xl font-bold">Reset Struktur Brand Default</Button><Button onClick={onQuickUpdate} variant="outline" className="h-11 rounded-2xl font-bold">Quick Update Saldo Hari Ini</Button><Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-2xl font-bold">Save to Cloud</Button></div></CardContent></Card>;
}
function financeSummary(accounts: FinanceAccount[]) { const brands = Array.from(new Set([...DEFAULT_FINANCE_BRANDS.filter((brand) => brand !== "Resto"), ...accounts.map((a) => a.brand).filter((brand) => Boolean(brand) && brand !== "Resto")])); return brands.map((brand) => { const rows = accounts.filter((a) => a.brand === brand); return { brand, groupCount: new Set(rows.map((r) => r.group)).size, entityCount: new Set(rows.map((r) => r.entity)).size, accountCount: rows.length, total: rows.reduce((a, r) => a + r.balance, 0), status: rows.length ? "Aktif" : "Kosong" }; }); }
function FinanceDashboard({ page, accounts, allAccounts, devices, setDevices, filters, lastSaved, onAddAccount, onUpdateAccount, onDeleteAccount }: { page: FinancePage; accounts: FinanceAccount[]; allAccounts: FinanceAccount[]; devices: FinanceDeviceStatus[]; setDevices: (rows: FinanceDeviceStatus[]) => void; filters: FinanceFilters; lastSaved: string | null; onAddAccount: (brand?: string, destination?: FinanceStructureItem) => void; onUpdateAccount: (id: string, patch: Partial<FinanceAccount>) => void; onDeleteAccount: (id: string) => void }) {
  const tab = financeTabFromPage(page); const scopedBrand = financeBrand(page);
  const filtered = accounts.filter((a) => (filters.group === ALL || a.group === filters.group) && (!filters.search || `${a.brand} ${a.group} ${a.entity} ${a.accountName} ${a.provider} ${a.accountNumber}`.toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b)=> filters.sort === "balance" ? b.balance - a.balance : filters.sort === "name" ? a.brand.localeCompare(b.brand) : DEFAULT_FINANCE_BRANDS.indexOf(a.brand) - DEFAULT_FINANCE_BRANDS.indexOf(b.brand));
  return <div className="space-y-6"><div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />Data finance tersimpan sebagai financeData terpisah dari taxData. {lastSaved && <span className="ml-2 text-slate-500">Last saved: {new Date(lastSaved).toLocaleString("id-ID")}</span>}</div>{tab === "overview" ? <FinanceOverview accounts={allAccounts} /> : tab === "devices" ? <DeviceStatusTable rows={devices} setRows={setDevices} /> : <BrandDetails accounts={filtered} allAccounts={allAccounts} scopedBrand={scopedBrand} onAddAccount={onAddAccount} onUpdateAccount={onUpdateAccount} onDeleteAccount={onDeleteAccount} />}</div>;
}
function FinanceOverview({ accounts }: { accounts: FinanceAccount[] }) {
  const visibleAccounts = accounts.filter((account) => account.brand !== "Resto");
  const summary = financeSummary(visibleAccounts);
  const providers = Array.from(new Set(visibleAccounts.map((account) => account.provider).filter(Boolean)));
  const total = summary.reduce((sum, brand) => sum + brand.total, 0);
  const brandColors: Record<string, string> = { "1001": "#EC4899", "MAISON Y": "#C026D3", Obsidian: "#111827", PADEL: "#F59E0B", GOSE: "#7C3AED", BAC: "#1687D9", OMG: "#64748B", "PT GLOBAL SEHAT BERKARYA": "#334155", "TRIPLE EGG": "#10B981", WOK: "#DC2626", HUNIAN: "#FDE68A", "PT SEBELUM HINGGA SESUDAH": "#047857", Resto: "#059669" };
  const kpis = [
    { label: "Total Saldo All Brand", value: total, money: true },
    { label: "Jumlah Brand", value: summary.length },
    { label: "Jumlah Rekening/Akun", value: visibleAccounts.length },
    { label: "Jumlah Bank/Provider", value: providers.length },
    { label: "Jumlah Payment Gateway", value: visibleAccounts.filter((account) => account.accountType === "Payment Gateway").length },
  ];

  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {kpis.map((item) => <Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm">
        <CardContent className="p-5">
          <p className="text-xs font-extrabold uppercase text-slate-500">{item.label}</p>
          <p className="mt-3 text-2xl font-black">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p>
        </CardContent>
      </Card>)}
    </section>

    <section>
      <div className="mb-4">
        <h2 className="text-xl font-black text-slate-950">Total Saldo per Brand</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Ringkasan otomatis dari seluruh rekening pada Brand Details.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((brand) => <Card
          key={brand.brand}
          style={{ backgroundColor: brandColors[brand.brand] ?? "#334155" }}
          className="overflow-hidden rounded-3xl border-0 text-white shadow-sm"
        >
          <CardContent className="p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Brand</p>
            <h3 className="mt-1 text-2xl font-black">{brand.brand}</h3>
            <p className="mt-7 text-sm font-semibold text-white/75">Total saldo brand</p>
            <p className="mt-1 text-3xl font-black tracking-tight">{rupiah(brand.total)}</p>
            <p className="mt-6 text-sm font-bold text-white/80">{plainNumber(brand.accountCount)} rekening / account</p>
          </CardContent>
        </Card>)}
      </div>
    </section>

    <FinanceSummaryTable summary={summary}/>
  </div>;
}
function FinanceSummaryTable({ summary }: { summary: ReturnType<typeof financeSummary> }) { return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Tabel ringkasan saldo per brand</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Brand","Jumlah Group","Jumlah Entity","Jumlah Rekening/Akun","Total Saldo","Status"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{summary.length ? summary.map((r)=><TableRow key={r.brand}><TableCell className="font-bold">{r.brand}</TableCell><TableCell>{plainNumber(r.groupCount)}</TableCell><TableCell>{plainNumber(r.entityCount)}</TableCell><TableCell>{plainNumber(r.accountCount)}</TableCell><TableCell className="font-bold">{rupiah(r.total)}</TableCell><TableCell><Badge variant={r.status==="Aktif"?"success":"secondary"}>{r.status}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm font-semibold text-slate-500">Belum ada data saldo</TableCell></TableRow>}</TableBody></Table></CardContent></Card>; }
function brandHeaderStyle(brand: string) { if (brand === "Obsidian") return { background: "#0F2147", color: "white" }; if (brand === "1001") return { background: "#EC4899", color: "white" }; if (brand === "Resto") return { background: "#10B981", color: "white" }; return undefined; }
function BrandDetails({ accounts, allAccounts, scopedBrand, onAddAccount, onUpdateAccount, onDeleteAccount }: { accounts: FinanceAccount[]; allAccounts: FinanceAccount[]; scopedBrand: string; onAddAccount: (brand?: string, destination?: FinanceStructureItem) => void; onUpdateAccount: (id: string, patch: Partial<FinanceAccount>) => void; onDeleteAccount: (id: string) => void }) {
  const brands = Array.from(new Set([...(scopedBrand ? [scopedBrand] : DEFAULT_FINANCE_BRANDS), ...accounts.map(a=>a.brand)]));
  return <div className="space-y-4">{brands.map((brand)=>{
    const rows = accounts.filter(a=>a.brand===brand);
    const brandRows = allAccounts.filter(a=>a.brand===brand);
    const structure = DEFAULT_FINANCE_STRUCTURE[brand] ?? [];
    const assignedIds = new Set<string>();
    const structuredRows = structure.map((item) => {
      const matches = rows.filter((row) => item.type === "group" ? row.group.toLowerCase() === item.name.toLowerCase() : row.entity.toLowerCase() === item.name.toLowerCase());
      matches.forEach((row) => assignedIds.add(row.id));
      return { item, rows: matches };
    });
    const legacyRows = rows.filter((row) => !assignedIds.has(row.id));
    const customStyle = brandHeaderStyle(brand);
    return <Card key={brand} className="overflow-hidden rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader style={customStyle} className={cn(!customStyle && "bg-gradient-to-r from-slate-900 to-blue-700", "text-white")}><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{brand}</CardTitle><CardDescription className="text-white/80">{plainNumber(brandRows.length)} rekening/akun</CardDescription></div><div className="text-right text-2xl font-black">{rupiah(brandRows.reduce((a,r)=>a+r.balance,0))}</div></div></CardHeader><CardContent className="space-y-4 p-5">
      {structuredRows.map(({ item, rows: itemRows }) => <div key={`${item.type}-${item.name}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div>{item.type === "group" ? <Badge className="bg-slate-800 text-white hover:bg-slate-800">GROUP {item.name.toUpperCase()}</Badge> : <><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Entity</p><h3 className="font-black text-slate-800">{item.name}</h3></>}</div><Button onClick={() => onAddAccount(brand, item)} size="sm" variant="outline" className="rounded-xl font-bold"><Plus className="h-3.5 w-3.5"/> Tambah Rekening</Button></div>{itemRows.length ? <FinanceAccountRows rows={itemRows} onUpdate={onUpdateAccount} onDelete={onDeleteAccount}/> : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">Belum ada rekening pada {item.type} ini.</p>}</div>)}
      {legacyRows.length > 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Rekening lama / belum terpetakan</p><h3 className="mb-3 font-black text-slate-800">Entity Default {brand}</h3><FinanceAccountRows rows={legacyRows} onUpdate={onUpdateAccount} onDelete={onDeleteAccount}/></div>}
      {!structure.length && !legacyRows.length && <EmptySaldoState />}
    </CardContent></Card>})}</div>;
}
function FinanceAccountRows({ rows, onUpdate, onDelete }: { rows: FinanceAccount[]; onUpdate: (id: string, patch: Partial<FinanceAccount>) => void; onDelete: (id: string) => void }) { return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Account Name","Provider","Account Number / Code","Account Type","Balance","Hapus"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell><Input value={r.accountName} onChange={(e)=>onUpdate(r.id,{accountName:e.target.value})} className="min-w-48 rounded-xl"/></TableCell><TableCell><Input value={r.provider} onChange={(e)=>onUpdate(r.id,{provider:e.target.value})} className="min-w-32 rounded-xl"/></TableCell><TableCell><Input value={r.accountNumber} onChange={(e)=>onUpdate(r.id,{accountNumber:e.target.value})} className="min-w-36 rounded-xl"/></TableCell><TableCell><Select value={r.accountType} onChange={(e)=>onUpdate(r.id,{accountType:e.target.value as FinanceAccountType})} className="min-w-40 rounded-xl"><option>Bank</option><option>Payment Gateway</option><option>Cash</option><option>Other</option></Select></TableCell><TableCell><Input value={String(r.balance)} onChange={(e)=>onUpdate(r.id,{balance:parseNumber(e.target.value)})} className="min-w-36 rounded-xl"/></TableCell><TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={()=>onDelete(r.id)}><Trash2 className="h-3 w-3"/> Hapus</Button></TableCell></TableRow>)}</TableBody></Table></div>; }
function DeviceStatusTable({ rows, setRows }: { rows: FinanceDeviceStatus[]; setRows: (rows: FinanceDeviceStatus[]) => void }) { const update=(id:string, patch:Partial<FinanceDeviceStatus>)=>setRows(rows.map(r=>r.id===id?{...r,...patch}:r)); return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Device Status</CardTitle><CardDescription>Tabel editable status perangkat finance.</CardDescription></div><Button onClick={()=>setRows([...rows,{id:`device-${crypto.randomUUID()}`,area:"",status:"OK",number:"",device:"",notes:""}])} className="rounded-2xl bg-blue-600"><Plus className="h-4 w-4"/> Tambah Row</Button></div></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Area","Status","Number","Device","Notes","Hapus"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}>{(["area","status","number","device","notes"] as const).map(k=><TableCell key={k}><Input value={r[k]} onChange={(e)=>update(r.id,{[k]:e.target.value})} className="min-w-36 rounded-xl"/></TableCell>)}<TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={()=>setRows(rows.filter(row=>row.id!==r.id))}><Trash2 className="h-3 w-3"/> Hapus</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>; }
function EmptySaldoState() { return <div className="grid h-full min-h-32 place-items-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">Belum ada data. KPI tetap Rp 0.</div>; }

function Documents({ documents, uploading, onUpload }: { documents: UploadedPdfDocument[]; uploading: boolean; onUpload: () => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle>Dokumen Pajak</CardTitle><CardDescription>{documents.length} file PDF sudah diupload dari cloud.</CardDescription></div><Button onClick={onUpload} disabled={uploading} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Upload className="h-4 w-4" /> {uploading ? "Mengupload..." : "Upload PDF"}</Button></div></CardHeader><CardContent className="space-y-3">{documents.length ? documents.map((doc) => <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-950">{doc.name}</p><p className="text-sm text-slate-500">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString("id-ID") : "Tanggal upload tidak tersedia"} • {fileSize(doc.size)}{doc.type ? ` • ${doc.type}` : ""}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/tax-documents/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Eye className="h-3 w-3" /> Lihat</a><a href={`/api/tax-documents/${doc.id}?download=1`} download={doc.originalName || doc.name} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Download className="h-3 w-3" /> Download</a></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-semibold text-slate-500">Belum ada PDF yang diupload. Klik Upload PDF untuk menambahkan dokumen pajak.</div>}</CardContent></Card>;
}
