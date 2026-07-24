"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parsePageTaxWorkbook, type TaxRecord, type UploadTaxPage } from "@/src/lib/parseTaxWorkbook";
import { Building2, CheckCircle2, Download, Edit3, Eye, FileArchive, FileSpreadsheet, Home, Landmark, Menu, Plus, Receipt, ShieldCheck, TrendingDown, TrendingUp, Trash2, Upload, WalletCards, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
type Page = "dashboard" | "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm" | "documents" | "financeOverview" | "financeDetails" | "financeDevices" | "financeObsidian" | "finance1001" | "financeResto";
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
type StaticTaxEntry = { id?: string; perusahaan?: string; tahun?: string; masaPajak?: string; masa_pajak?: string; jenisPajak?: TaxType; jenis_pajak?: TaxType; dpp?: number | string; pajak?: number | string; pajakTerhutang?: number | string; ntpnNtpd?: string; ntpn_ntpd?: string; tanggalBayar?: string | null; tanggal_bayar?: string | null; ppnKeluaran?: number | string; ppn_keluaran?: number | string; ppnMasukan?: number | string; ppn_masukan?: number | string; pmTidakDikreditkan?: number | string; pm_tidak_dikreditkan?: number | string; totalPembayaranPpn?: number | string; status?: string; statusAuto?: string; status_auto?: string; keterangan?: string; sourceData?: "Static File" | "Excel Import" | "Manual Input"; source_data?: "Static File" | "Excel Import" | "Manual Input"; sourceSheet?: string; source_sheet?: string; sourceRow?: number; source_row?: number; uploadBatchId?: string | null; upload_batch_id?: string | null; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string };

type SummaryOverrides = Record<string, number>;
type KpiItem = { label: string; value: number; money?: boolean };
type DashboardTaxKind = "PPN" | "PPh Pasal 21" | "PPh Unifikasi" | "PB1" | "UMKM";

const pageMeta: Record<Page, { title: string; subtitle: string; types?: TaxType[] }> = {
  dashboard: { title: "Dashboard Tax All Group", subtitle: "" },
  ppn: { title: "PPN", subtitle: "Monitoring Pajak Pertambahan Nilai", types: ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN", "PPN"] },
  pph21: { title: "PPh Pasal 21", subtitle: "Monitoring Pajak Atas Penghasilan Karyawan & Imbalan Atas Jasa", types: ["PPh Pasal 21"] },
  unifikasi: { title: "PPh Unifikasi", subtitle: "Monitoring Pajak Atas Jasa, Sewa dan Persewaan Atas Tanah Dan Bangunan", types: ["PPh Pasal 23", "PPh Final 4(2)"] },
  pb1: { title: "PB1", subtitle: "Monitoring Pajak Daerah", types: ["PB1"] },
  umkm: { title: "PPh UMKM", subtitle: "Monitoring Pajak Atas Usaha Mikro, Kecil dan Menengah", types: ["PPh UMKM"] },
  documents: { title: "Dokumen Pajak", subtitle: "Daftar SPT, Billing, dan SSP" },
  financeOverview: { title: "Dashboard Finance", subtitle: "Overview saldo, brand details, dan device status dari Excel update saldo." },
  financeDetails: { title: "Brand Details", subtitle: "Struktur brand, group, entity, dan rekening finance." },
  financeDevices: { title: "Device Status", subtitle: "Monitoring device finance dan operasional." },
  financeObsidian: { title: "Finance Obsidian", subtitle: "Detail rekening dan saldo brand Obsidian." },
  finance1001: { title: "Finance 1001", subtitle: "Detail rekening dan saldo brand 1001." },
  financeResto: { title: "Finance Resto", subtitle: "Detail rekening dan saldo brand Resto." },
};

const taxNavItems = [
  ["dashboard", Home, "Dashboard Tax All Group"], ["ppn", Receipt, "PPN"], ["pph21", Receipt, "PPh Pasal 21"], ["unifikasi", Receipt, "PPh Unifikasi"], ["pb1", Building2, "PB1"], ["umkm", Building2, "PPh UMKM"], ["documents", FileArchive, "Dokumen Pajak"],
] as const;
const financeNavItems = [
  ["financeOverview", WalletCards, "Overview"], ["financeDetails", Landmark, "Brand Details"], ["financeDevices", ShieldCheck, "Device Status"],
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
function ppnPayment(rows: TaxTransaction[]) { return sum(rows, "Pembayaran PPN") + rows.filter((r) => r.jenisPajak === "PPN").reduce((total, row) => total + (row.totalPembayaranPpn ?? row.pajakTerhutang), 0); }
function totalTaxPayments(rows: TaxTransaction[]) { return ppnPayment(rows) + sum(rows, "PPh Pasal 21") + sum(rows, "PPh Pasal 23") + sum(rows, "PPh Final 4(2)") + sum(rows, "PB1") + sum(rows, "PPh UMKM"); }
function isPaid(row: TaxTransaction) { return Boolean(clean(row.ntpnNtpd)) || row.status === "Terverifikasi" || row.statusAuto === "Sudah ada NTPN/NTPD"; }
function dashboardKind(type: TaxType): DashboardTaxKind { if (["PPN", "PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "Pembayaran PPN"].includes(type)) return "PPN"; if (type === "PPh Pasal 21") return "PPh Pasal 21"; if (type === "PPh Pasal 23" || type === "PPh Final 4(2)") return "PPh Unifikasi"; if (type === "PB1") return "PB1"; return "UMKM"; }



type FinanceAccountType = "Bank" | "Payment Gateway" | "Cash" | "Other";
type FinanceAccount = { id: string; brand: string; group: string; entity: string; accountName: string; provider: string; accountNumber: string; accountType: FinanceAccountType; balance: number; source: "Excel Import" | "Manual Input" | string };
type FinanceDeviceStatus = { id: string; area: string; status: string; number: string; device: string; notes: string };
type FinanceTab = "overview" | "details" | "devices";
type FinancePage = "financeOverview" | "financeDetails" | "financeDevices" | "financeObsidian" | "finance1001" | "financeResto";
type FinanceFilters = { search: string; group: string; sort: string };
const FINANCE_FILTER_STORAGE_KEY = "finance-dashboard-filters-v1";
const DEFAULT_FINANCE_BRANDS = ["Obsidian", "1001", "Resto"];
const DEFAULT_DEVICE_STATUS: FinanceDeviceStatus[] = [
  ["Online", "Perlu cek", "0811", "Android POS", "Follow up harian"], ["Gym", "OK", "0812", "iPhone Finance", "Aktif"], ["Store", "OK", "0813", "Android POS", "Aktif"], ["Finance Hunian", "Perlu cek", "0814", "iPhone Finance", "Follow up harian"], ["Jajan", "OK", "0815", "Android POS", "Aktif"], ["Maison PT", "OK", "0816", "iPhone Finance", "Aktif"], ["Maison CV", "Perlu cek", "0817", "Android POS", "Follow up harian"], ["Tax HO Jakarta", "OK", "0818", "iPhone Finance", "Aktif"], ["HRD HO Jakarta", "OK", "0819", "Android POS", "Aktif"], ["CS Maison", "Perlu cek", "0820", "iPhone Finance", "Follow up harian"],
].map(([area, status, number, device, notes]) => ({ id: `device-${crypto.randomUUID()}`, area, status, number, device, notes }));
function parseNumber(value: unknown) { return numberValue(value); }
function inferAccount(accountName: string): { provider: string; accountType: FinanceAccountType } { const t = accountName.toLowerCase(); if (t.includes("xendit")) return { provider: "Xendit", accountType: "Payment Gateway" }; if (t.includes("cash")) return { provider: "Cash", accountType: "Cash" }; for (const bank of ["BCA", "OCBC", "BRI", "Mandiri", "Permata"]) if (t.includes(bank.toLowerCase())) return { provider: bank, accountType: "Bank" }; return { provider: clean(accountName.split(/\s+/)[0]) || "Other", accountType: "Other" }; }
function normalizeFinanceBrand(value: string) { const text = clean(value); if (/^obsidian$/i.test(text)) return "Obsidian"; if (/^resto$/i.test(text)) return "Resto"; return text.toUpperCase() === "1001" ? "1001" : text; }
function normalizeFinanceAccount(row: Partial<Omit<FinanceAccount, "balance">> & { balance?: unknown }): FinanceAccount { const inferred = inferAccount(clean(row.accountName)); return { id: clean(row.id) || `finance-${crypto.randomUUID()}`, brand: normalizeFinanceBrand(clean(row.brand)) || "Brand Belum Diisi", group: clean(row.group) || "Default", entity: clean(row.entity) || "Entity Belum Diisi", accountName: clean(row.accountName) || "Account Belum Diisi", provider: clean(row.provider) || inferred.provider, accountNumber: clean(row.accountNumber), accountType: (clean(row.accountType) as FinanceAccountType) || inferred.accountType, balance: parseNumber(row.balance), source: row.source || "Excel Import" }; }
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
function financeBrand(page: FinancePage) { return page === "financeObsidian" ? "Obsidian" : page === "finance1001" ? "1001" : page === "financeResto" ? "Resto" : ""; }
function financeTabFromPage(page: Page): FinanceTab { if (page === "financeDetails" || page === "financeObsidian" || page === "finance1001" || page === "financeResto") return "details"; if (page === "financeDevices") return "devices"; return "overview"; }

type ManualForm = { id?: string; perusahaan: string; tahun: string; masaPajak: string; jenisPajak: TaxType; dpp: string; pajak: string; ntpnNtpd: string; tanggalBayar: string; status: string; keterangan: string; ppnKeluaran: string; ppnMasukan: string; pmTidakDikreditkan: string; totalPembayaranPpn: string };
const emptyManualForm = (page: Page): ManualForm => ({ id: undefined, perusahaan: "", tahun: DEFAULT_DASHBOARD_YEAR, masaPajak: "", jenisPajak: page === "pb1" ? "PB1" : page === "ppn" ? "PPN" : page === "umkm" ? "PPh UMKM" : page === "unifikasi" ? "PPh Pasal 23" : "PPh Pasal 21", dpp: "", pajak: "", ntpnNtpd: "", tanggalBayar: "", status: "", keterangan: "", ppnKeluaran: "", ppnMasukan: "", pmTidakDikreditkan: "", totalPembayaranPpn: "" });
function manualButtonLabel(page: Page) { if (page === "dashboard") return "+ Tambah Data Pajak Manual"; if (page === "ppn") return "+ Tambah Data PPN"; if (page === "pb1") return "+ Tambah Data PB 1"; return "+ Tambah Data PPh"; }
function isManualPage(page: Page) { return page !== "documents" && !isFinancePage(page); }
function normalizeManualRecord(form: ManualForm): TaxTransaction {
  const isPpn = form.jenisPajak === "PPN";
  const dppNumber = isPpn ? numberValue(form.ppnKeluaran) : numberValue(form.dpp);
  const computedPpn = numberValue(form.ppnKeluaran) - numberValue(form.ppnMasukan);
  const pajakTerhutang = isPpn ? (clean(form.totalPembayaranPpn) ? numberValue(form.totalPembayaranPpn) : computedPpn) : numberValue(form.pajak);
  const statusAuto = automaticStatus(pajakTerhutang, form.ntpnNtpd, form.keterangan, dppNumber);
  const now = new Date().toISOString();
  return { id: form.id || `manual-${crypto.randomUUID()}`, perusahaan: clean(form.perusahaan), tahun: normalizeYear(form.tahun), masaPajak: clean(form.masaPajak), jenisPajak: form.jenisPajak, dpp: dppNumber, pajakTerhutang, ntpnNtpd: clean(form.ntpnNtpd), tanggalBayar: normalizePaymentDateForStorage(form.tanggalBayar), ppnKeluaran: isPpn ? numberValue(form.ppnKeluaran) : undefined, ppnMasukan: isPpn ? numberValue(form.ppnMasukan) : undefined, pmTidakDikreditkan: isPpn ? numberValue(form.pmTidakDikreditkan) : undefined, status: clean(form.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(form.keterangan) || (isPpn ? `PPN Keluaran ${rupiah(numberValue(form.ppnKeluaran))}; PPN Masukan ${rupiah(numberValue(form.ppnMasukan))}; PM Tidak Dikreditkan ${rupiah(numberValue(form.pmTidakDikreditkan))}` : ""), sourceData: "Manual Input", sourceSheet: "Manual Input", sourceRow: 0, createdAt: now, updatedAt: now };
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
  return { id: clean(row.id) || `static-${index + 1}`, perusahaan: clean(row.perusahaan) || "Perusahaan Belum Diisi", tahun: normalizeYear(row.tahun || periodYear(clean(row.masaPajak ?? row.masa_pajak))), masaPajak: clean(row.masaPajak ?? row.masa_pajak) || "-", jenisPajak: (row.jenisPajak ?? row.jenis_pajak ?? "PPh Pasal 21") as TaxType, dpp: dppValue, pajakTerhutang: pajakValue, ntpnNtpd, tanggalBayar: normalizePaymentDate(row.tanggalBayar ?? row.tanggal_bayar), ppnKeluaran: numberValue(row.ppnKeluaran ?? row.ppn_keluaran), ppnMasukan: numberValue(row.ppnMasukan ?? row.ppn_masukan), pmTidakDikreditkan: numberValue(row.pmTidakDikreditkan ?? row.pm_tidak_dikreditkan), totalPembayaranPpn: row.totalPembayaranPpn === undefined ? undefined : numberValue(row.totalPembayaranPpn), status: clean(row.status) || displayStatus(statusAuto), statusAuto, keterangan: clean(row.keterangan), sourceData: row.sourceData ?? row.source_data ?? "Static File", sourceSheet: clean(row.sourceSheet ?? row.source_sheet) || "tax-data.json", sourceRow: Number(row.sourceRow ?? row.source_row) || index + 1, uploadBatchId: row.uploadBatchId ?? row.upload_batch_id, createdAt: clean(row.createdAt ?? row.created_at), updatedAt: clean(row.updatedAt ?? row.updated_at) };
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


export function TaxCoordinatorDashboard() {
  const [records, setRecords] = useState<TaxTransaction[]>([]);
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
      setMessage(loaded.length ? "Data berhasil dimuat dari Blob bersama." : "Blob kosong. Dashboard tampil Rp 0 sampai data diimport/manual lalu Save to Cloud.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data Blob.");
    } finally { setLoading(false); }
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
  function addFinanceAccount(brand = "") { setFinanceAccounts((rows) => [...rows, normalizeFinanceAccount({ brand: brand || "Obsidian", group: "Default", entity: "Entity Belum Diisi", accountName: "Account Baru", balance: 0, source: "Manual Input" })]); setMessage("Rekening finance ditambahkan. Klik Save to Cloud agar tersimpan."); }
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

  return <main className="min-h-screen bg-[#EEF3F8] text-slate-950" style={page === "dashboard" ? { fontFamily: PROFESSIONAL_FONT_STACK } : undefined}>
    <Sidebar page={page} setPage={setPage} open={drawerOpen} setOpen={setDrawerOpen} />
    <div className="min-h-screen lg:pl-72">
      <header className="sticky top-0 z-20 border-b border-[#D8E0EA] bg-[#EEF3F8]/90 px-4 py-3 backdrop-blur lg:hidden"><Button variant="outline" onClick={() => setDrawerOpen(true)}><Menu className="h-4 w-4" /> Menu</Button></header>
      <section className="space-y-6 p-4 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>{meta.subtitle && <p className="mt-2 text-base font-medium text-slate-600">{meta.subtitle}</p>}</div>{isManualPage(page) && page !== "dashboard" && <Button onClick={() => openManual()} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> {manualButtonLabel(page)}</Button>}</div>
        {isFinancePage(page) ? <FinanceActionBar filters={financeFilters} setFilters={setFinanceFilters} options={financeOptions} activeTab={financeTabFromPage(page)} setPage={setPage} onUpload={() => updateSaldoInputRef.current?.click()} onSave={saveUpdateSaldoToCloud} saving={busy} /> : <FilterBar filters={filters} updateFilter={updateFilter} options={{ tahun: yearOptions, masaPajak: MONTH_NAMES, perusahaan: options("perusahaan"), jenisPajak: page === "dashboard" ? DASHBOARD_FILTER_TAX_TYPES : TAX_TYPES.filter((type) => !meta.types || meta.types.includes(type)), status: FILTER_STATUSES }} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} onSave={saveToCloud} saving={busy} showDataEntryActions={page !== "dashboard" && page !== "documents" && !isFinancePage(page)} showStatusAndSearch={page !== "documents" && page !== "dashboard" && !isFinancePage(page)} />}
        <Input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
        <Input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" onChange={uploadPdf} className="hidden" />
        <Input ref={updateSaldoInputRef} type="file" accept=".xlsx,.xls" onChange={importUpdateSaldoExcel} className="hidden" />
        <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />{loading ? "Memuat data pajak..." : message}{!records.length && !loading && " KPI akan menampilkan 0 sampai data tersedia."}{lastSaved && <span className="ml-2 text-slate-500">Last saved: {new Date(lastSaved).toLocaleString("id-ID")}</span>}</div>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isFinancePage(page) ? <FinanceDashboard page={page as FinancePage} accounts={financeScopedAccounts} allAccounts={financeAccounts} devices={financeDevices} setDevices={setFinanceDevices} filters={financeFilters} lastSaved={financeLastSaved} onUpload={() => updateSaldoInputRef.current?.click()} onAddAccount={() => addFinanceAccount(isFinancePage(page) ? financeBrand(page) : "")} onUpdateAccount={updateFinanceAccount} onDeleteAccount={deleteFinanceAccount} /> : page === "documents" ? <Documents documents={pdfDocuments} uploading={pdfUploading} onUpload={() => pdfInputRef.current?.click()} /> : page === "dashboard" ? <DashboardOverview rows={dashboardRows} documentCount={pdfDocuments.length} /> : <><KpiGrid items={buildKpis(page, summaryRows, summaryOverrides)} onEdit={async (label, value) => { const password = await verifyPassword(); if (!password) return; const input = window.prompt(`Edit nominal ${label}`, String(value)); if (input === null) return; if (input === "") { setSummaryOverrides((cur) => { const next = { ...cur }; delete next[label]; return next; }); } else { setSummaryOverrides((cur) => ({ ...cur, [label]: numberValue(input) })); } setMessage("Override summary diubah. Klik Save to Cloud untuk persist."); }} /><TransactionTable rows={summaryRows} title={`Tabel detail ${meta.title}`} isDashboard={false} onEdit={openManual} onDelete={deleteManual} onUpload={() => inputRef.current?.click()} onManual={() => openManual()} hideTaxType={page === "ppn"} /></>}
      </section>
    </div>
    {modalOpen && <ManualModal page={page} form={form} setForm={setForm} errors={formErrors} onClose={() => setModalOpen(false)} onSave={saveManual} saving={busy} />}
  </main>;
}

function Sidebar({ page, setPage, open, setOpen }: { page: Page; setPage: (page: Page) => void; open: boolean; setOpen: (open: boolean) => void }) {
  const renderItems = (items: typeof taxNavItems | typeof financeNavItems) => items.map(([id, Icon, label]) => <button key={id} onClick={() => { setPage(id); setOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition", page === id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5" />{label}</button>);
  return <aside className={cn("fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto bg-[#020617] p-5 text-white shadow-2xl transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30"><Receipt className="h-6 w-6" /></div><div><p className="text-lg font-black">Tax Coordinator</p><p className="text-xs font-semibold text-slate-400">Tax & Finance Dashboard</p></div></div><Button variant="ghost" size="icon" className="text-white lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button></div>
    <nav className="space-y-6"><div><p className="mb-2 px-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Dashboard Tax</p><div className="space-y-2">{renderItems(taxNavItems)}</div></div><div><p className="mb-2 px-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Dashboard Finance</p><div className="space-y-2">{renderItems(financeNavItems)}</div></div></nav>
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
  if (page === "unifikasi") return [{ label: "Total PPh 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total DPP", value: dpp(rows), money: true }, { label: "Total pembayaran", value: sum(rows), money: true }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "pb1") return [{ label: "Total DPP PB1", value: dpp(rows), money: true }, { label: "Total PB1", value: sum(rows), money: true }, { label: "Jumlah NTPD", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPD kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  if (page === "umkm") return [{ label: "Total DPP UMKM", value: dpp(rows), money: true }, { label: "Total PPh UMKM", value: sum(rows), money: true }, { label: "Jumlah transaksi", value: rows.length }, { label: "NTPN terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "NTPN kosong", value: rows.filter((r) => !r.ntpnNtpd).length }];
  return [{ label: "Total PPN Keluaran", value: ppnOutput(rows), money: true }, { label: "Total PPN Masukan", value: ppnInput(rows), money: true }, { label: "Total PM Tidak Dikreditkan", value: ppnNonCreditable(rows), money: true }, { label: "Total Pembayaran PPN", value: ppnPayment(rows), money: true }, { label: "Total PPh Pasal 21", value: sum(rows, "PPh Pasal 21"), money: true }, { label: "Total PPh Pasal 23", value: sum(rows, "PPh Pasal 23"), money: true }, { label: "Total PPh Final 4(2)", value: sum(rows, "PPh Final 4(2)"), money: true }, { label: "Total PB1", value: sum(rows, "PB1"), money: true }, { label: "Total PPh UMKM", value: sum(rows, "PPh UMKM"), money: true }, { label: "Total seluruh pembayaran pajak", value: totalTaxPayments(rows), money: true }, { label: "Jumlah perusahaan", value: new Set(rows.map((r) => r.perusahaan)).size }, { label: "Jumlah masa pajak", value: new Set(rows.map((r) => r.masaPajak)).size }, { label: "Jumlah NTPN/NTPD terisi", value: rows.filter((r) => r.ntpnNtpd).length }, { label: "Belum memiliki NTPN/NTPD", value: rows.filter((r) => !r.ntpnNtpd).length }];
}

const DASHBOARD_COLORS: Record<DashboardTaxKind, string> = { PPN: "#2563eb", "PPh Pasal 21": "#16a34a", "PPh Unifikasi": "#f97316", PB1: "#dc2626", UMKM: "#7c3aed" };
const DASHBOARD_KINDS: DashboardTaxKind[] = ["PPN", "PPh Pasal 21", "PPh Unifikasi", "PB1", "UMKM"];
type TaxTypeSummary = { name: DashboardTaxKind; value: number; paid: number; balance: number; totalRows: number; verifiedRows: number; reviewRows: number; status: "Terverifikasi" | "Perlu Review" | "Belum Lengkap" };
type TaxTrendPoint = { masa: string; total: number };
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
function getTaxTrendData(rows: TaxTransaction[] = []): TaxTrendPoint[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  return Array.from(safeRows.reduce<Map<string, TaxTransaction[]>>((acc, row) => {
    const key = clean(row.masaPajak) || "-";
    acc.set(key, [...(acc.get(key) ?? []), row]);
    return acc;
  }, new Map())).sort(([a], [b]) => periodSort(a) - periodSort(b)).map(([masa, periodRows]) => ({ masa, total: getDashboardSummary(periodRows).totalTax }));
}

function DashboardOverview({ rows, documentCount }: { rows?: TaxTransaction[]; documentCount?: number }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const summary = getDashboardSummary(safeRows, documentCount);
  const taxByKind = getTaxTypeSummary(safeRows);
  const donutData = getTaxCompositionData(safeRows);
  const chartData = taxByKind;
  const trendData = getTaxTrendData(safeRows);
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
    <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Tren Pajak per Masa</CardTitle><CardDescription>Nilai pajak berdasarkan masa pajak yang tersedia.</CardDescription></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData.length ? trendData : [{ masa: "-", total: 0 }]}><defs><linearGradient id="taxTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.28}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="masa" /><YAxis tickFormatter={(value: number) => `${Math.round(value / 1000000)} jt`} width={54} /><Tooltip formatter={(value: number) => rupiah(value)} /><Area type="monotone" dataKey="total" name="Total Pajak" stroke="#2563eb" strokeWidth={3} fill="url(#taxTrend)" /></AreaChart></ResponsiveContainer></CardContent></Card>
    <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Ringkasan Pajak per Jenis</CardTitle><CardDescription>Status ringkas untuk kebutuhan review management.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Jenis Pajak", "Total Pajak", "Sudah Dibayar", "KB/LB", "Status"].map((head) => <TableHead key={head} className="text-xs uppercase text-slate-500">{head}</TableHead>)}</TableRow></TableHeader><TableBody>{chartData.length ? chartData.map((item) => <TableRow key={item.name} className="hover:bg-slate-50"><TableCell className="font-bold"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DASHBOARD_COLORS[item.name] }} />{item.name}</TableCell><TableCell>{rupiah(item.value)}</TableCell><TableCell>{rupiah(item.paid)}</TableCell><TableCell className={item.balance > 0 ? "font-bold text-orange-600" : "font-bold text-emerald-600"}>{rupiah(item.balance)}</TableCell><TableCell><Badge variant={item.status === "Terverifikasi" ? "success" : item.status === "Perlu Review" ? "warning" : "secondary"}>{item.status}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm font-semibold text-slate-500">Belum ada data sesuai filter.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>;
}

function KpiGrid({ items, onEdit }: { items: KpiItem[]; onEdit: (label: string, value: number) => void }) { return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</p>{item.money && <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit nominal / kosongkan input untuk Reset override" onClick={() => onEdit(item.label, item.value)}><Edit3 className="h-3.5 w-3.5" /></Button>}</div><p className="mt-3 text-2xl font-black text-slate-950">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p></CardContent></Card>)}</section>; }
function TransactionTable({ title, rows, isDashboard, onEdit, onDelete, onUpload, onManual, hideTaxType = false }: { title: string; rows: TaxTransaction[]; isDashboard: boolean; onEdit: (row: TaxTransaction) => void; onDelete: (id: string) => void; onUpload: () => void; onManual: () => void; hideTaxType?: boolean }) {
  const headers = isDashboard ? ["Perusahaan", "Masa Pajak", "Jenis Pajak", "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Keterangan", "Aksi"] : ["Perusahaan", "Masa Pajak", ...(hideTaxType ? [] : ["Jenis Pajak"]), "DPP", "Pajak Terhutang", "NTPN/NTPD", "Status", "Source", "Hapus"];
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{rows.length} baris data.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((h) => <TableHead key={h} className="text-xs uppercase text-slate-500">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((r) => <TableRow key={r.id} className="hover:bg-slate-50"><TableCell className="min-w-56 font-semibold">{r.perusahaan}</TableCell><TableCell>{r.masaPajak}</TableCell>{!hideTaxType && <TableCell>{r.jenisPajak}</TableCell>}<TableCell>{rupiah(r.dpp)}</TableCell><TableCell className={r.pajakTerhutang < 0 ? "font-bold text-red-600" : ""}>{rupiah(r.pajakTerhutang)}</TableCell><TableCell>{r.ntpnNtpd || "-"}</TableCell><TableCell><Badge variant={statusTone(r.status)}>{r.status === "Terverifikasi" && <CheckCircle2 className="mr-1 h-3 w-3" />}{r.status}</Badge><div className="mt-1 text-[11px] font-semibold text-slate-400">{r.statusAuto}</div></TableCell><TableCell><Badge variant={r.sourceData === "Manual Input" ? "success" : "secondary"}>{r.sourceData || "Excel Import"}</Badge></TableCell>{!isDashboard && <TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></TableCell>}{isDashboard && <><TableCell className="min-w-72">{r.keterangan || `${r.sourceSheet} baris ${r.sourceRow}`}</TableCell><TableCell>{r.sourceData === "Manual Input" ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(r)}><Edit3 className="h-3 w-3" /> Edit</Button><Button size="sm" variant="outline" onClick={() => onDelete(r.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div> : <Badge variant="secondary">Excel Import</Badge>}</TableCell></>}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-36 text-center text-sm font-semibold text-slate-500"><div className="space-y-4"><p>{isDashboard ? "Belum ada data manual." : "Belum ada data. Upload Excel atau tambahkan data manual."}</p><div className="flex justify-center gap-3">{!isDashboard && <><Button onClick={onUpload} className="rounded-2xl bg-blue-600"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={onManual} variant="outline" className="rounded-2xl"><Plus className="h-4 w-4" /> Tambah Data Manual</Button></>}</div></div></TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
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

function FinanceActionBar({ filters, setFilters, options, activeTab, setPage, onUpload, onSave, saving }: { filters: FinanceFilters; setFilters: (filters: FinanceFilters) => void; options: { group: string[] }; activeTab: FinanceTab; setPage: (page: Page) => void; onUpload: () => void; onSave: () => void; saving: boolean }) {
  const set = (key: keyof FinanceFilters, value: string) => setFilters({ ...filters, [key]: value });
  const tabs: [FinanceTab, Page, string][] = [["overview", "financeOverview", "Overview"], ["details", "financeDetails", "Brand Details"], ["devices", "financeDevices", "Device Status"]];
  return <Card className="rounded-3xl border-[#D8E0EA] shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex flex-wrap gap-2">{tabs.map(([tab, target, label]) => <Button key={tab} variant={activeTab === tab ? "default" : "outline"} onClick={() => setPage(target)} className={cn("rounded-2xl font-bold", activeTab === tab && "bg-blue-600 hover:bg-blue-700")}>{label}</Button>)}</div><div className="flex flex-wrap items-center gap-3"><Input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Search brand/account/provider/code" className="h-11 flex-1 basis-full rounded-2xl bg-white lg:basis-72" /><Select value={filters.group} onChange={(e) => set("group", e.target.value)} className="h-11 flex-1 basis-40 rounded-2xl bg-white"><option value={ALL}>Semua kategori/group</option>{options.group.map((v) => <option key={v} value={v}>{v}</option>)}</Select><Select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className="h-11 flex-1 basis-40 rounded-2xl bg-white"><option value="structure">Urutan struktur</option><option value="balance">Saldo terbesar</option><option value="name">Nama A-Z</option></Select><Button onClick={onUpload} className="h-11 rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Upload className="h-4 w-4" /> Upload Excel</Button><Button onClick={() => alert("Struktur brand default: Obsidian, 1001, Resto.")} variant="outline" className="h-11 rounded-2xl font-bold">Reset Struktur Brand Default</Button><Button onClick={() => alert("Quick Update Saldo Hari Ini siap dipakai lewat edit balance di Brand Details.")} variant="outline" className="h-11 rounded-2xl font-bold">Quick Update Saldo Hari Ini</Button><Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-2xl font-bold">Save to Cloud</Button></div></CardContent></Card>;
}
function financeSummary(accounts: FinanceAccount[]) { const brands = Array.from(new Set([...DEFAULT_FINANCE_BRANDS, ...accounts.map((a) => a.brand).filter(Boolean)])); return brands.map((brand) => { const rows = accounts.filter((a) => a.brand === brand); return { brand, groupCount: new Set(rows.map((r) => r.group)).size, entityCount: new Set(rows.map((r) => r.entity)).size, accountCount: rows.length, total: rows.reduce((a, r) => a + r.balance, 0), status: rows.length ? "Aktif" : "Kosong" }; }); }
function FinanceDashboard({ page, accounts, allAccounts, devices, setDevices, filters, lastSaved, onUpload, onAddAccount, onUpdateAccount, onDeleteAccount }: { page: FinancePage; accounts: FinanceAccount[]; allAccounts: FinanceAccount[]; devices: FinanceDeviceStatus[]; setDevices: (rows: FinanceDeviceStatus[]) => void; filters: FinanceFilters; lastSaved: string | null; onUpload: () => void; onAddAccount: () => void; onUpdateAccount: (id: string, patch: Partial<FinanceAccount>) => void; onDeleteAccount: (id: string) => void }) {
  const tab = financeTabFromPage(page); const scopedBrand = financeBrand(page);
  const filtered = accounts.filter((a) => (filters.group === ALL || a.group === filters.group) && (!filters.search || `${a.brand} ${a.group} ${a.entity} ${a.accountName} ${a.provider} ${a.accountNumber}`.toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b)=> filters.sort === "balance" ? b.balance - a.balance : filters.sort === "name" ? a.brand.localeCompare(b.brand) : DEFAULT_FINANCE_BRANDS.indexOf(a.brand) - DEFAULT_FINANCE_BRANDS.indexOf(b.brand));
  return <div className="space-y-6"><div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-blue-600" />Data finance tersimpan sebagai financeData terpisah dari taxData. {lastSaved && <span className="ml-2 text-slate-500">Last saved: {new Date(lastSaved).toLocaleString("id-ID")}</span>}</div>{tab === "overview" ? <FinanceOverview accounts={allAccounts} onUpload={onUpload} /> : tab === "devices" ? <DeviceStatusTable rows={devices} setRows={setDevices} /> : <BrandDetails accounts={filtered} scopedBrand={scopedBrand} onAddAccount={onAddAccount} onUpdateAccount={onUpdateAccount} onDeleteAccount={onDeleteAccount} />}</div>;
}
function FinanceOverview({ accounts, onUpload }: { accounts: FinanceAccount[]; onUpload: () => void }) { const summary = financeSummary(accounts); const providers = Array.from(new Set(accounts.map((a) => a.provider).filter(Boolean))); const providerData = providers.map((p) => ({ name: p, value: accounts.filter((a) => a.provider === p).reduce((t, r) => t + r.balance, 0) })); const colors = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#dc2626", "#0891b2"]; const total = accounts.reduce((a,r)=>a+r.balance,0); const kpis = [{label:"Total Saldo All Brand", value:total, money:true}, {label:"Total Saldo Obsidian", value:summary.find(s=>s.brand==="Obsidian")?.total ?? 0, money:true}, {label:"Total Saldo 1001", value:summary.find(s=>s.brand==="1001")?.total ?? 0, money:true}, {label:"Total Saldo Resto", value:summary.find(s=>s.brand==="Resto")?.total ?? 0, money:true}, {label:"Jumlah Brand", value:new Set(accounts.map(a=>a.brand)).size}, {label:"Jumlah Rekening/Akun", value:accounts.length}, {label:"Jumlah Bank/Provider", value:providers.length}, {label:"Jumlah Payment Gateway", value:accounts.filter(a=>a.accountType==="Payment Gateway").length}]; return <div className="space-y-6"><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis.map((item)=><Card key={item.label} className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardContent className="p-5"><p className="text-xs font-extrabold uppercase text-slate-500">{item.label}</p><p className="mt-3 text-2xl font-black">{item.money ? rupiah(item.value) : plainNumber(item.value)}</p></CardContent></Card>)}</section><section className="grid gap-4 xl:grid-cols-3"><ChartCard title="Komposisi saldo per brand">{accounts.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary} dataKey="total" nameKey="brand" innerRadius="55%" outerRadius="78%">{summary.map((entry,i)=><Cell key={entry.brand} fill={colors[i%colors.length]} />)}</Pie><Tooltip formatter={(v:number)=>rupiah(v)} /><Legend /></PieChart></ResponsiveContainer> : <EmptySaldoState />}</ChartCard><ChartCard title="Saldo per brand">{accounts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="brand"/><YAxis tickFormatter={(v:number)=>`${Math.round(v/1000000)} jt`}/><Tooltip formatter={(v:number)=>rupiah(v)}/><Bar dataKey="total" fill="#2563eb" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer> : <EmptySaldoState />}</ChartCard><ChartCard title="Saldo per provider/bank">{providerData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={providerData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={(v:number)=>`${Math.round(v/1000000)} jt`}/><Tooltip formatter={(v:number)=>rupiah(v)}/><Bar dataKey="value" fill="#16a34a" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer> : <EmptySaldoState />}</ChartCard></section><FinanceSummaryTable summary={summary} onUpload={onUpload}/></div>; }
function ChartCard({ title, children }: { title: string; children: ReactNode }) { return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="h-72">{children}</CardContent></Card>; }
function FinanceSummaryTable({ summary, onUpload }: { summary: ReturnType<typeof financeSummary>; onUpload: () => void }) { return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><CardTitle>Tabel ringkasan saldo per brand</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Brand","Jumlah Group","Jumlah Entity","Jumlah Rekening/Akun","Total Saldo","Status"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{summary.length ? summary.map((r)=><TableRow key={r.brand}><TableCell className="font-bold">{r.brand}</TableCell><TableCell>{plainNumber(r.groupCount)}</TableCell><TableCell>{plainNumber(r.entityCount)}</TableCell><TableCell>{plainNumber(r.accountCount)}</TableCell><TableCell className="font-bold">{rupiah(r.total)}</TableCell><TableCell><Badge variant={r.status==="Aktif"?"success":"secondary"}>{r.status}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center"><Button onClick={onUpload} className="rounded-2xl bg-blue-600"><Upload className="h-4 w-4"/> Upload Excel update saldo</Button></TableCell></TableRow>}</TableBody></Table></CardContent></Card>; }
function BrandDetails({ accounts, scopedBrand, onAddAccount, onUpdateAccount, onDeleteAccount }: { accounts: FinanceAccount[]; scopedBrand: string; onAddAccount: () => void; onUpdateAccount: (id: string, patch: Partial<FinanceAccount>) => void; onDeleteAccount: (id: string) => void }) { const brands = Array.from(new Set([...(scopedBrand ? [scopedBrand] : DEFAULT_FINANCE_BRANDS), ...accounts.map(a=>a.brand)])); return <div className="space-y-4">{brands.map((brand)=>{ const rows=accounts.filter(a=>a.brand===brand); return <Card key={brand} className="overflow-hidden rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader className="bg-gradient-to-r from-slate-900 to-blue-700 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{brand}</CardTitle><CardDescription className="text-blue-100">{plainNumber(rows.length)} rekening/akun</CardDescription></div><div className="text-right text-2xl font-black">{rupiah(rows.reduce((a,r)=>a+r.balance,0))}</div></div></CardHeader><CardContent className="space-y-4 p-5">{rows.length ? Array.from(new Set(rows.map(r=>r.group))).map(group=><div key={group} className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-3 font-black text-slate-800">{group}</h3>{Array.from(new Set(rows.filter(r=>r.group===group).map(r=>r.entity))).map(entity=><div key={entity} className="mb-4"><p className="mb-2 text-sm font-extrabold text-slate-500">{entity}</p><FinanceAccountRows rows={rows.filter(r=>r.group===group&&r.entity===entity)} onUpdate={onUpdateAccount} onDelete={onDeleteAccount}/></div>)}</div>) : <EmptySaldoState />}<Button onClick={onAddAccount} variant="outline" className="rounded-2xl font-bold"><Plus className="h-4 w-4"/> Tambah Rekening</Button></CardContent></Card>})}</div>; }
function FinanceAccountRows({ rows, onUpdate, onDelete }: { rows: FinanceAccount[]; onUpdate: (id: string, patch: Partial<FinanceAccount>) => void; onDelete: (id: string) => void }) { return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Account Name","Provider","Account Number","Account Type","Balance","Hapus"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell><Input value={r.accountName} onChange={(e)=>onUpdate(r.id,{accountName:e.target.value})} className="min-w-48 rounded-xl"/></TableCell><TableCell><Input value={r.provider} onChange={(e)=>onUpdate(r.id,{provider:e.target.value})} className="min-w-32 rounded-xl"/></TableCell><TableCell><Input value={r.accountNumber} onChange={(e)=>onUpdate(r.id,{accountNumber:e.target.value})} className="min-w-36 rounded-xl"/></TableCell><TableCell><Select value={r.accountType} onChange={(e)=>onUpdate(r.id,{accountType:e.target.value as FinanceAccountType})} className="min-w-40 rounded-xl"><option>Bank</option><option>Payment Gateway</option><option>Cash</option><option>Other</option></Select></TableCell><TableCell><Input value={String(r.balance)} onChange={(e)=>onUpdate(r.id,{balance:parseNumber(e.target.value)})} className="min-w-36 rounded-xl"/></TableCell><TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={()=>onDelete(r.id)}><Trash2 className="h-3 w-3"/> Hapus</Button></TableCell></TableRow>)}</TableBody></Table></div>; }
function DeviceStatusTable({ rows, setRows }: { rows: FinanceDeviceStatus[]; setRows: (rows: FinanceDeviceStatus[]) => void }) { const update=(id:string, patch:Partial<FinanceDeviceStatus>)=>setRows(rows.map(r=>r.id===id?{...r,...patch}:r)); return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Device Status</CardTitle><CardDescription>Tabel editable status perangkat finance.</CardDescription></div><Button onClick={()=>setRows([...rows,{id:`device-${crypto.randomUUID()}`,area:"",status:"OK",number:"",device:"",notes:""}])} className="rounded-2xl bg-blue-600"><Plus className="h-4 w-4"/> Tambah Row</Button></div></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["Area","Status","Number","Device","Notes","Hapus"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}>{(["area","status","number","device","notes"] as const).map(k=><TableCell key={k}><Input value={r[k]} onChange={(e)=>update(r.id,{[k]:e.target.value})} className="min-w-36 rounded-xl"/></TableCell>)}<TableCell><Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={()=>setRows(rows.filter(row=>row.id!==r.id))}><Trash2 className="h-3 w-3"/> Hapus</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>; }
function EmptySaldoState() { return <div className="grid h-full min-h-32 place-items-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">Belum ada data. KPI tetap Rp 0.</div>; }

function Documents({ documents, uploading, onUpload }: { documents: UploadedPdfDocument[]; uploading: boolean; onUpload: () => void }) {
  return <Card className="rounded-3xl border-[#D8E0EA] bg-white shadow-sm"><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle>Dokumen Pajak</CardTitle><CardDescription>{documents.length} file PDF sudah diupload dari cloud.</CardDescription></div><Button onClick={onUpload} disabled={uploading} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Upload className="h-4 w-4" /> {uploading ? "Mengupload..." : "Upload PDF"}</Button></div></CardHeader><CardContent className="space-y-3">{documents.length ? documents.map((doc) => <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-950">{doc.name}</p><p className="text-sm text-slate-500">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString("id-ID") : "Tanggal upload tidak tersedia"} • {fileSize(doc.size)}{doc.type ? ` • ${doc.type}` : ""}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/tax-documents/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Eye className="h-3 w-3" /> Lihat</a><a href={`/api/tax-documents/${doc.id}?download=1`} download={doc.originalName || doc.name} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"><Download className="h-3 w-3" /> Download</a></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-semibold text-slate-500">Belum ada PDF yang diupload. Klik Upload PDF untuk menambahkan dokumen pajak.</div>}</CardContent></Card>;
}
