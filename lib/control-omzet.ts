import * as XLSX from "xlsx";

export const CONTROL_OMZET_SHEET = "YTD Control Omzet";
export const CONTROL_OMZET_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;
const GROUPS = ["1001", "Obsidian", "Resto", "Management"];

export type ControlOmzetStatus = "Aman" | "Perlu Review" | "Tidak Terlapor" | "Lebih Terlapor" | "Tidak Ada Data";
export type ControlOmzetRow = { masa: string; tahun: number; group: string; entity: string; omzet: number; terlapor: number; selisih: number; persentaseTerlapor: number };

function text(value: unknown) { return String(value ?? "").trim(); }
function valueOf(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object") {
    const cell = value as { v?: unknown; w?: unknown };
    return valueOf(cell.v ?? cell.w);
  }
  const cleaned = text(value).replace(/\((.*)\)/, "-$1").replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
function period(value: unknown) {
  const match = text(value).toLowerCase().match(/\b(jan|feb|mar|apr|may|mei|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)[a-z]*[\s\-/]*(\d{2,4})?\b/);
  if (!match) return null;
  const aliases = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const normalized = match[1].replace("mei", "may").replace("agu", "aug").replace("okt", "oct").replace("des", "dec");
  const year = match[2] ? Number(match[2].length === 2 ? `20${match[2]}` : match[2]) : 2026;
  return { masa: CONTROL_OMZET_MONTHS[aliases.indexOf(normalized)], tahun: Number.isFinite(year) ? year : 2026 };
}
function groupOf(value: unknown, fallback = "") { const found = GROUPS.find((group) => text(value).toLowerCase().includes(group.toLowerCase())); return found ?? fallback; }
function create(masa: string, tahun: number, group: string, entity: string, omzet: unknown, terlapor: unknown): ControlOmzetRow {
  const omzetNumber = valueOf(omzet); const terlaporNumber = valueOf(terlapor);
  return { masa, tahun, group, entity, omzet: omzetNumber, terlapor: terlaporNumber, selisih: omzetNumber - terlaporNumber, persentaseTerlapor: omzetNumber === 0 ? 0 : terlaporNumber / omzetNumber * 100 };
}

export function controlOmzetStatus(row: Pick<ControlOmzetRow, "omzet" | "terlapor" | "persentaseTerlapor">): ControlOmzetStatus {
  if (row.omzet === 0 && row.terlapor === 0) return "Tidak Ada Data";
  if (row.omzet > 0 && row.terlapor === 0) return "Tidak Terlapor";
  if (row.terlapor > row.omzet) return "Lebih Terlapor";
  if (row.omzet > 0 && row.persentaseTerlapor < 80) return "Perlu Review";
  return "Aman";
}

export function parseControlOmzetWorkbook(data: ArrayBuffer): ControlOmzetRow[] {
  const workbook = XLSX.read(data, { type: "array", cellFormula: true, cellNF: false, cellText: true });
  const sheet = workbook.Sheets[CONTROL_OMZET_SHEET];
  if (!sheet) throw new Error("Sheet YTD Control Omzet tidak ditemukan.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: 0, raw: true });
  if (!rows.length) return [];
  const results: ControlOmzetRow[] = [];
  // Layout A: each period is a row and every entity owns an Omset/Terlapor column pair.
  const periodRowIndexes = rows.map((row, index) => ({ index, info: period(row.find((cell) => period(cell))) })).filter((item) => item.info);
  if (periodRowIndexes.length >= 2) {
    const first = periodRowIndexes[0].index;
    const entityHeader = rows.slice(0, first).findLast((row) => row.filter((cell) => text(cell) && !/omset|omzet|terlapor/i.test(text(cell))).length >= 2) ?? [];
    let group = ""; let entity = "";
    for (let column = 0; column < Math.max(...rows.map((row) => row.length)); column++) {
      group = groupOf(entityHeader[column], group);
      const candidate = text(entityHeader[column]);
      if (candidate && !groupOf(candidate) && !period(candidate) && !/masa|bulan|group|omset|omzet|terlapor/i.test(candidate)) entity = candidate;
      if (!entity) continue;
      const subheaders = rows.slice(Math.max(0, first - 3), first).map((row) => text(row[column]).toLowerCase()).join(" ");
      if (!/omset|omzet/.test(subheaders)) continue;
      for (const item of periodRowIndexes) { const info = item.info!; results.push(create(info.masa, info.tahun, groupOf(entityHeader[column], group), entity, rows[item.index][column], rows[item.index][column + 1])); }
    }
  }
  if (results.length) return results;
  // Layout B: periods own adjacent Omset/Terlapor columns and entities are rows.
  const headerIndex = rows.findIndex((row) => row.filter((cell) => period(cell)).length >= 2);
  if (headerIndex >= 0) {
    let group = "";
    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r]; const labels = row.slice(0, 4).map(text).filter(Boolean);
      const explicitGroup = labels.map((label) => groupOf(label)).find(Boolean); if (explicitGroup) group = explicitGroup;
      const entity = labels.find((label) => !period(label) && !groupOf(label) && !/entity|perusahaan|group|omset|omzet|terlapor/i.test(label));
      if (!entity) continue;
      rows[headerIndex].forEach((header, column) => { const info = period(header); if (info) results.push(create(info.masa, info.tahun, group, entity, row[column], row[column + 1])); });
    }
  }
  if (!results.length) throw new Error("Format Excel Control Omzet tidak sesuai.");
  return results;
}
