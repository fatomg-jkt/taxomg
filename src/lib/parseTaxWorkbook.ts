import * as XLSX from "xlsx";

export type TaxRecord = {
  id: string;
  sourceSheet: string;
  company: string;
  masa: string;
  jenisPajak: string;
  dpp: number;
  pajakTerutang: number;
  ntpnNtpd: string;
  status: string;
  source: "Excel Upload" | "Manual";
  keterangan?: string;
  year?: string;
  ppnKeluaran?: number;
  ppnMasukan?: number;
  pmTidakDikreditkan?: number;
  totalPembayaranPpn?: number;
};

export type UploadTaxPage = "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm";

const DEFAULT_UPLOAD_YEAR = "2026";
const UPLOAD_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTH_ALIASES: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3,
  mei: 4, may: 4, jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, aug: 7, agustus: 7,
  sep: 8, september: 8, okt: 9, oct: 9, oktober: 9, nov: 10, november: 10,
  des: 11, dec: 11, desember: 11,
};

function uploadPeriod(value: unknown) {
  if (value instanceof Date) return UPLOAD_MONTHS[value.getMonth()];
  if (typeof value === "number" && value > 20000) {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? UPLOAD_MONTHS[date.m - 1] : "-";
  }
  const text = clean(value);
  if (!text) return "-";
  const alias = text.toLowerCase().match(/^[a-z]+/)?.[0];
  const index = alias === undefined ? undefined : MONTH_ALIASES[alias];
  return index === undefined ? text : UPLOAD_MONTHS[index];
}

function normalizedHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Parse the simple, page-specific upload format. Only the first worksheet is read. */
export function parsePageTaxWorkbook(arrayBuffer: ArrayBuffer, page: UploadTaxPage): TaxRecord[] {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Format Excel tidak sesuai. Pastikan baris pertama berisi header kolom.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], { header: 1, defval: "", blankrows: false });
  const headers = (rows[0] ?? []).map(normalizedHeader);
  const column = (name: string) => headers.indexOf(normalizedHeader(name));
  const requiredRecognition = ["Perusahaan", "Masa Pajak", "Tahun", "DPP", "NTPN/NTPD", "Status"];
  if (!requiredRecognition.some((name) => column(name) >= 0)) {
    throw new Error("Format Excel tidak sesuai. Pastikan baris pertama berisi header kolom.");
  }
  const value = (row: unknown[], name: string) => { const index = column(name); return index >= 0 ? row[index] : ""; };
  const typeFor = (raw: unknown): TaxRecord["jenisPajak"] => {
    if (page === "ppn") return "PPN";
    if (page === "pph21") return "PPh Pasal 21";
    if (page === "pb1") return "PB1";
    if (page === "umkm") return "PPh UMKM";
    const text = clean(raw).toLowerCase();
    if (/4\s*\(?2\)?|final/.test(text)) return "PPh Final 4(2)";
    return "PPh Pasal 23";
  };
  return rows.slice(1).filter((row) => row.some((cell) => clean(cell))).map((row, index) => {
    const company = clean(value(row, "Perusahaan"));
    const period = uploadPeriod(value(row, "Masa Pajak"));
    const year = normalizeUploadYear(value(row, "Tahun"));
    const ntpnNtpd = clean(value(row, "NTPN/NTPD"));
    const dpp = num(value(row, "DPP"));
    const ppnKeluaran = num(value(row, "PPN Keluaran"));
    const ppnMasukan = num(value(row, "PPN Masukan"));
    const suppliedTax = clean(value(row, "Pajak Terutang"));
    const umkmTax = num(value(row, "PPh UMKM"));
    const computedTax = page === "ppn" ? ppnKeluaran - ppnMasukan : page === "umkm" && !suppliedTax ? umkmTax : 0;
    const pajakTerutang = suppliedTax ? num(suppliedTax) : computedTax;
    const suppliedPayment = clean(value(row, page === "ppn" ? "Pembayaran PPN" : "Pembayaran Pajak"));
    const payment = suppliedPayment ? num(suppliedPayment) : page === "ppn" && ntpnNtpd ? pajakTerutang : 0;
    return {
      id: `upload-${page}-${index + 2}-${uuid()}`, sourceSheet: firstSheetName, company, masa: period,
      year, jenisPajak: typeFor(value(row, "Jenis Pajak")), dpp,
      pajakTerutang, ntpnNtpd,
      status: clean(value(row, "Status")) || (ntpnNtpd ? "Terverifikasi" : "Belum Lengkap"),
      source: "Excel Upload", ppnKeluaran: page === "ppn" ? ppnKeluaran : undefined,
      ppnMasukan: page === "ppn" ? ppnMasukan : undefined,
      pmTidakDikreditkan: page === "ppn" ? num(value(row, "PM Tidak Dikreditkan")) : undefined,
      totalPembayaranPpn: page === "ppn" ? payment : undefined,
    };
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const clean = (value: unknown) => String(value ?? "").trim();
const hasNtpn = (value: string) => Boolean(value && value !== "-");

function num(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  const raw = clean(value);
  if (!raw || raw === "-") return 0;
  const text = raw.replace(/\((.*)\)/, "-$1").replace(/[^\d,.-]/g, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  const decimal = comma > dot ? comma : dot;
  const fraction = decimal >= 0 ? text.slice(decimal + 1) : "";
  const normalized = fraction.length > 0 && fraction.length <= 2 ? `${text.slice(0, decimal).replace(/[.,]/g, "")}.${fraction.replace(/[.,]/g, "")}` : text.replace(/[.,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function normalizeUploadYear(value: unknown) { const year = Number(clean(value)); return Number.isFinite(year) && year >= 2026 ? String(Math.trunc(year)) : DEFAULT_UPLOAD_YEAR; }

function masa(value: unknown) {
  if (value instanceof Date) return `${MONTHS[value.getMonth()]}-${String(value.getFullYear()).slice(-2)}`;
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${MONTHS[d.m - 1]}-${String(Math.max(d.y, 2026)).slice(-2)}` : "";
  }
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${MONTHS[parsed.getMonth()]}-${String(Math.max(parsed.getFullYear(), 2026)).slice(-2)}`;
  return text;
}

function uuid() { return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2); }
function status(company: string, period: string, tax: number, ntpn: string) {
  if (!company || !period) return "Belum Lengkap";
  if (tax > 0 && !hasNtpn(ntpn)) return "Belum ada NTPN/NTPD";
  if (hasNtpn(ntpn)) return "Terverifikasi";
  return "Belum Lengkap";
}
function skip(dpp: number, tax: number, ntpn: string) { return !dpp && !tax && !hasNtpn(ntpn); }

function make(sourceSheet: TaxRecord["sourceSheet"], row: number, company: string, period: string, jenisPajak: string, dppRaw: unknown, taxRaw: unknown, ntpnRaw: unknown): TaxRecord[] {
  const dpp = num(dppRaw); const pajakTerutang = num(taxRaw); const ntpnNtpd = clean(ntpnRaw);
  if (skip(dpp, pajakTerutang, ntpnNtpd)) return [];
  return [{ id: `${sourceSheet}-${row}-${jenisPajak}-${uuid()}`, sourceSheet, company, masa: period, jenisPajak, dpp, pajakTerutang, ntpnNtpd, status: status(company, period, pajakTerutang, ntpnNtpd), source: "Excel Upload" }];
}

export function parseTaxWorkbook(arrayBuffer: ArrayBuffer): TaxRecord[] {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const out: TaxRecord[] = [];
  const sheet = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" });
  let company = "";
  for (const [name, start, mappings] of [["PPH-Resto", 4, [[2,3,4,"PPh Pasal 21"],[5,6,7,"PPh Pasal 23"],[8,9,10,"PPh Final 4(2)"],[11,12,13,"PB1"],[14,15,16,"PPh UMKM"]]], ["PPH-1001", 4, [[2,3,4,"PPh Pasal 21"],[5,6,7,"PPh Pasal 23"],[8,9,10,"PPh Final 4(2)"],[11,12,13,"PPh UMKM"]]]] as const) {
    if (!wb.Sheets[name]) continue; company = "";
    sheet(name).slice(start).forEach((r, i) => { company = clean(r[0]) || company; const period = masa(r[1]); mappings.forEach(([d,t,n,type]) => out.push(...make(name, start + i + 1, company, period, type, r[d], r[t], r[n]))); });
  }
  if (wb.Sheets["PPN-1001"]) {
    const rows = sheet("PPN-1001"); const comp = clean(rows[2]?.[1]);
    rows.slice(6).forEach((r, i) => { const period = masa(r[1]); out.push(...make("PPN-1001", i + 7, comp, period, "PPN Keluaran", r[2], r[3], r[7])); out.push(...make("PPN-1001", i + 7, comp, period, "PPN Masukan", r[4], r[5], r[7])); out.push(...make("PPN-1001", i + 7, comp, period, "Pembayaran PPN", 0, r[6], r[7])); });
  }
  if (wb.Sheets["PPH-OBS"]) { company = ""; sheet("PPH-OBS").slice(5).forEach((r, i) => { company = clean(r[1]) || company; const period = masa(r[2]); [[3,4,5,"PPh Pasal 21"],[6,7,8,"PPh Pasal 23"],[9,10,11,"PPh Final 4(2)"],[12,13,14,"PPh UMKM"],[15,16,17,"PB1"]].forEach(([d,t,n,type]) => out.push(...make("PPH-OBS", i + 6, company, period, String(type), r[Number(d)], r[Number(t)], r[Number(n)]))); }); }
  return out;
}
