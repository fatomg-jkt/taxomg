import * as XLSX from "xlsx";
import type { CompanyProfile } from "@/lib/legal-data";

const FIELD_LABELS: Record<string, keyof CompanyProfile> = {
  bisnis: "businessField",
  "akta pendirian": "establishmentDeed",
  "akta perubahan": "amendmentDeed",
  "tanggal mulai beroperasi": "operationStartDate",
  npwp: "npwp", npwpd: "npwpd", skpkp: "skpkp", nib: "nib",
  "kbli sesuai nib": "kbli", "pengesahan kemenkumham": "kemenkumhamApproval",
  direktur: "director", komisaris: "commissioner",
};

function text(value: unknown): string {
  if (value instanceof Date) return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
  return String(value ?? "").trim();
}

function label(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ").replace(/\s*:\s*$/, "");
}

function groupName(value: unknown) {
  const normalized = text(value).toUpperCase();
  if (normalized.includes("HOLDING")) return "Holding";
  if (normalized.includes("OBSIDIAN")) return "Obsidian";
  if (/1001|SERIBU\s*SATU/.test(normalized)) return "1001";
  if (normalized.includes("TRIPLE EGG")) return "Triple Egg";
  return text(value);
}

export function parseCompanyProfileWorkbook(buffer: ArrayBuffer, now = new Date()): CompanyProfile[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets.Holding;
  if (!sheet) throw new Error("Sheet Holding tidak ditemukan.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (rows.length < 4) throw new Error("Format Excel Company Profile tidak sesuai.");

  const entityRow = rows[2] ?? [];
  const groupRow = rows[1] ?? [];
  const entities: Array<{ column: number; companyName: string; brandGroup: string }> = [];
  let currentGroup = groupName(groupRow[1]);
  for (let column = 2; column < Math.max(entityRow.length, groupRow.length); column += 1) {
    if (text(groupRow[column])) currentGroup = groupName(groupRow[column]);
    const companyName = text(entityRow[column]);
    if (companyName) entities.push({ column, companyName, brandGroup: currentGroup });
  }
  const labels = rows.map((row) => label(row?.[1]));
  if (!entities.length || !labels.includes("bisnis")) throw new Error("Format Excel Company Profile tidak sesuai.");
  const shareholderStart = labels.findIndex((value) => value.startsWith("pemegang saham"));
  const timestamp = now.toISOString();

  return entities.map(({ column, companyName, brandGroup }, index) => {
    const values: Partial<Record<keyof CompanyProfile, string>> = {};
    labels.forEach((rowLabel, rowIndex) => {
      const key = FIELD_LABELS[rowLabel];
      if (key) values[key] = text(rows[rowIndex]?.[column]);
    });
    const shareholders: string[] = [];
    if (shareholderStart >= 0) {
      for (let rowIndex = shareholderStart; rowIndex < rows.length; rowIndex += 1) {
        const rowLabel = labels[rowIndex];
        if (rowIndex > shareholderStart && rowLabel && !rowLabel.startsWith("pemegang saham")) break;
        const value = text(rows[rowIndex]?.[column]);
        if (value && !shareholders.includes(value)) shareholders.push(value);
      }
    }
    const operationStartDate = values.operationStartDate ?? "";
    const npwp = values.npwp ?? "";
    const nib = values.nib ?? "";
    const notOperating = operationStartDate.toLowerCase().includes("belum beroperasi");
    const notes = [!npwp && "NPWP belum tersedia", !nib && "NIB belum tersedia", notOperating && "Belum beroperasi"].filter(Boolean).join("; ");
    return {
      id: `company-excel-${index + 1}-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
      companyName, brandGroup, businessField: values.businessField ?? "",
      establishmentDeed: values.establishmentDeed ?? "", amendmentDeed: values.amendmentDeed ?? "",
      operationStartDate, npwp, npwpd: values.npwpd ?? "", skpkp: values.skpkp ?? "", nib,
      kbli: values.kbli ?? "", kemenkumhamApproval: values.kemenkumhamApproval ?? "",
      director: values.director ?? "", commissioner: values.commissioner ?? "", shareholders: shareholders.join("\n"),
      status: notOperating ? "Belum Beroperasi" : npwp || nib ? "Aktif" : "Perlu Update",
      notes, source: "Excel Import", createdAt: timestamp, updatedAt: timestamp,
    };
  });
}
