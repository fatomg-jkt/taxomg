import * as XLSX from "xlsx";

export type TaxRecord = {
  id: string;
  sourceSheet: "PPH-Resto" | "PPN-1001" | "PPH-1001" | "PPH-OBS" | "Manual";
  company: string;
  masa: string;
  jenisPajak: string;
  dpp: number;
  pajakTerutang: number;
  ntpnNtpd: string;
  status: string;
  source: "Excel Upload" | "Manual";
  keterangan?: string;
};

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

function masa(value: unknown) {
  if (value instanceof Date) return `${MONTHS[value.getMonth()]}-${String(value.getFullYear()).slice(-2)}`;
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${MONTHS[d.m - 1]}-${String(d.y).slice(-2)}` : "";
  }
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return `${MONTHS[parsed.getMonth()]}-${String(parsed.getFullYear()).slice(-2)}`;
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
