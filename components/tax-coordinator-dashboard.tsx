"use client";

import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TaxType =
  | "PPN Keluaran"
  | "PPN Masukan"
  | "PM Tidak Dikreditkan"
  | "KB/LB PPN"
  | "PPh 21"
  | "PPh 23"
  | "PPh Final 4(2)"
  | "PB1"
  | "PPh UMKM";
type Status =
  | "Terverifikasi"
  | "Belum Lengkap"
  | "Nihil"
  | "Lebih Bayar"
  | "Kompensasi";
type TaxRecord = {
  id: string;
  companyName: string;
  taxPeriod: string;
  taxType: TaxType;
  dpp: number;
  taxAmount: number;
  ntpn: string;
  ntpd: string;
  status: Status;
  sourceSheet: string;
  sourceRow: number;
  note: string;
  inputSource: "excel_import" | "manual_input";
  createdAt: string;
  updatedAt: string;
};
type TaxDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  category: string;
  companyName: string;
  taxPeriod: string;
  taxType: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
};
type MenuId =
  | "dashboard"
  | "ppn"
  | "pph21"
  | "unifikasi"
  | "pb1"
  | "umkm"
  | "documents";

const ALL = "Semua";
const PPN_COMPANY = "CV SEPULUH JANUARI SUKSES";
const STORAGE_KEY = "tax-coordinator-tax-records-v4";
const DOC_KEY = "tax-coordinator-tax-documents-v4";
const DB_NAME = "tax-coordinator-pdf-db";
const DOC_STORE = "pdf-files";
const SOURCE_SHEETS = ["PPH-Resto", "PPN-1001", "PPH-1001", "PPH-OBS"];
const DOC_CATEGORIES = [
  "SPT Masa PPN",
  "SPT Masa PPh 21",
  "SPT Masa PPh Unifikasi",
  "PB1",
  "PPh UMKM",
  "Bukti Potong",
  "Bukti Bayar",
  "NTPN",
  "Surat DJP",
  "Dokumen Pendukung",
];
const TAX_TYPES: TaxType[] = [
  "PPN Keluaran",
  "PPN Masukan",
  "PM Tidak Dikreditkan",
  "KB/LB PPN",
  "PPh 21",
  "PPh 23",
  "PPh Final 4(2)",
  "PB1",
  "PPh UMKM",
];
const menus: { id: MenuId; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "ppn", label: "PPN", icon: ReceiptText },
  { id: "pph21", label: "PPh Pasal 21", icon: FileText },
  { id: "unifikasi", label: "PPh Unifikasi", icon: FileText },
  { id: "pb1", label: "PB1", icon: Store },
  { id: "umkm", label: "PPh UMKM", icon: Store },
  { id: "documents", label: "Dokumen Pajak", icon: FolderOpen },
];

const blankRecord: TaxRecord = {
  id: "",
  companyName: "",
  taxPeriod: "",
  taxType: "PPh 21",
  dpp: 0,
  taxAmount: 0,
  ntpn: "",
  ntpd: "",
  status: "Nihil",
  sourceSheet: "Manual",
  sourceRow: 0,
  note: "",
  inputSource: "manual_input",
  createdAt: "",
  updatedAt: "",
};
const COLUMN_LABELS: Record<string, string> = {
  perusahaan: "Perusahaan",
  companyName: "Perusahaan",
  masaPajak: "Masa Pajak",
  taxPeriod: "Masa Pajak",
  jenisPajak: "Jenis Pajak",
  taxType: "Jenis Pajak",
  totalDpp: "DPP",
  dpp: "DPP",
  totalPajak: "Pajak Terhutang",
  pajak: "Pajak Terhutang",
  ntpnNtptd: "NTPN/NTPD",
  ntpnNtpd: "NTPN/NTPD",
  ntpn: "NTPN/NTPD",
  pkPpn: "PK PPN",
  pmPpn: "PM PPN",
  kbLb: "KB/LB",
  status: "Status",
  fileName: "Nama File",
  category: "Kategori",
  uploadedAt: "Tanggal Upload",
  fileSize: "Ukuran File",
  fileUrl: "File URL",
  aksi: "Aksi",
};
const INTERNAL_TABLE_COLUMNS = new Set(["keterangan", "sourceSheet", "note"]);

function humanizeColumnName(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((word) =>
      /^(dpp|ppn|pph|pb1|umkm|ntpn|ntpd|url|kb|lb)$/i.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function safeJson<T>(value: string | null, fallback: T) {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
function money(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
function numeric(value: unknown) {
  return (
    Number(
      String(value ?? "")
        .replace(/\((.*)\)/, "-$1")
        .replace(/[^\d.-]/g, ""),
    ) || 0
  );
}
function normalize(value: unknown) {
  return String(value ?? "").trim();
}
function headerLabel(key: string) {
  return COLUMN_LABELS[key] ?? humanizeColumnName(key);
}
function period(value: unknown) {
  if (typeof value === "number" && value > 20000) {
    const d = XLSX.SSF.parse_date_code(value);
    return new Date(d.y, d.m - 1, d.d)
      .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      .replace(" ", "-");
  }
  const text = normalize(value);
  if (!text) return "-";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? text
    : parsed
        .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        .replace(" ", "-");
}
function computeStatus(
  taxAmount: number,
  dpp: number,
  ntpn: string,
  ntpd: string,
  note: string,
): Status {
  const text = `${ntpn} ${ntpd} ${note}`.toLowerCase();
  if (text.includes("kompensasi")) return "Kompensasi";
  if (taxAmount < 0 || /\blb\b|lebih bayar/.test(text)) return "Lebih Bayar";
  if (!taxAmount && !dpp) return "Nihil";
  return (ntpn || ntpd) && !text.includes("ntpn tidak ada")
    ? "Terverifikasi"
    : "Belum Lengkap";
}
function completeRecord(row: TaxRecord) {
  const now = new Date().toISOString();
  const company = row.companyName.trim() || "Perusahaan Belum Diisi";
  return {
    ...row,
    id: row.id || crypto.randomUUID(),
    companyName: company,
    taxPeriod: row.taxPeriod || "-",
    status: computeStatus(row.taxAmount, row.dpp, row.ntpn, row.ntpd, row.note),
    updatedAt: now,
    createdAt: row.createdAt || now,
  };
}
function hasTaxValue(row: unknown[]) {
  return (
    row.some((cell) => numeric(cell) !== 0) ||
    row.some((cell) => /lb|kompensasi|ntpn/i.test(normalize(cell)))
  );
}
function csv(
  name: string,
  rows: Record<string, unknown>[],
  columns?: string[],
) {
  const fallback = rows[0] ?? { info: "Tidak ada data" };
  const keys = (columns ?? Object.keys(fallback)).filter(
    (key) => !INTERNAL_TABLE_COLUMNS.has(key) && key !== "id" && key !== "aksi",
  );
  const body = [
    keys.map(headerLabel).join(","),
    ...rows.map((r) =>
      keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name;
  a.click();
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DOC_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putPdf(id: string, file: File) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getPdf(id: string) {
  const database = await db();
  return new Promise<string>((resolve, reject) => {
    const tx = database.transaction(DOC_STORE, "readonly");
    const req = tx.objectStore(DOC_STORE).get(id);
    req.onsuccess = () => resolve(URL.createObjectURL(req.result as Blob));
    req.onerror = () => reject(req.error);
  });
}
async function deletePdf(id: string) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function parseSheet(sheetName: string, raw: unknown[][]) {
  const rows: TaxRecord[] = [];
  let lastCompany = "";
  raw.forEach((r, idx) => {
    if (idx === 0 || !hasTaxValue(r)) return;
    const companyCandidate = normalize(r[0]);
    if (companyCandidate && !/masa|periode|bulan/i.test(companyCandidate))
      lastCompany = companyCandidate;
    const companyName = lastCompany || "Perusahaan Belum Diisi";
    const taxPeriod = period(r[1] ?? r[0]);
    const note = r
      .map(normalize)
      .filter((x) =>
        /lb|lebih bayar|kompensasi|ntpn tidak ada|keterangan/i.test(x),
      )
      .join("; ");
    const add = (
      taxType: TaxType,
      dpp: unknown,
      tax: unknown,
      payment: unknown,
      ntpd = false,
    ) => {
      const rec = completeRecord({
        ...blankRecord,
        companyName,
        taxPeriod,
        taxType,
        dpp: numeric(dpp),
        taxAmount: numeric(tax),
        ntpn: ntpd ? "" : normalize(payment),
        ntpd: ntpd ? normalize(payment) : "",
        sourceSheet: sheetName,
        sourceRow: idx + 1,
        note,
        inputSource: "excel_import",
      });
      if (rec.dpp || rec.taxAmount || rec.ntpn || rec.ntpd || rec.note)
        rows.push(rec);
    };
    if (sheetName === "PPN-1001") {
      add("PPN Keluaran", r[2], r[3], r[10]);
      add("PPN Masukan", r[4], r[5], r[10]);
      add("PM Tidak Dikreditkan", r[6], r[7], r[10]);
      add(
        "KB/LB PPN",
        0,
        r[8] ?? numeric(r[3]) - numeric(r[5]) - numeric(r[7]),
        r[10],
      );
      return;
    }
    add("PPh 21", r[2], r[3], r[4]);
    add("PPh 23", r[5], r[6], r[7]);
    add("PPh Final 4(2)", r[8], r[9], r[10]);
    add("PB1", r[11], r[12], r[13], true);
    add("PPh UMKM", r[14], r[15], r[16]);
  });
  return rows;
}

export function TaxCoordinatorDashboard() {
  const [active, setActive] = useState<MenuId>("dashboard");
  const [mobile, setMobile] = useState(false);
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(ALL);
  const [taxPeriod, setTaxPeriod] = useState(ALL);
  const [taxType, setTaxType] = useState(ALL);
  const [payStatus, setPayStatus] = useState(ALL);
  const [sourceSheet, setSourceSheet] = useState(ALL);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<TaxRecord>(blankRecord);
  const [docDraft, setDocDraft] = useState({
    category: DOC_CATEGORIES[0],
    companyName: "",
    taxPeriod: "",
    taxType: "PPN",
  });
  const excelRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setRecords(safeJson(localStorage.getItem(STORAGE_KEY), []));
    setDocuments(safeJson(localStorage.getItem(DOC_KEY), []));
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);
  useEffect(() => {
    localStorage.setItem(DOC_KEY, JSON.stringify(documents));
  }, [documents]);
  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (company === ALL || r.companyName === company) &&
          (taxPeriod === ALL || r.taxPeriod === taxPeriod) &&
          (taxType === ALL || r.taxType === taxType) &&
          (payStatus === ALL || r.status === payStatus) &&
          (sourceSheet === ALL || r.sourceSheet === sourceSheet) &&
          `${r.companyName} ${r.taxPeriod} ${r.taxType} ${r.ntpn} ${r.ntpd} ${r.note}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [records, company, taxPeriod, taxType, payStatus, sourceSheet, search],
  );
  const ppnRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          r.companyName.toUpperCase() === PPN_COMPANY &&
          [
            "PPN Keluaran",
            "PPN Masukan",
            "PM Tidak Dikreditkan",
            "KB/LB PPN",
          ].includes(r.taxType) &&
          (taxPeriod === ALL || r.taxPeriod === taxPeriod) &&
          (taxType === ALL || r.taxType === taxType) &&
          (payStatus === ALL || r.status === payStatus) &&
          (sourceSheet === ALL || r.sourceSheet === sourceSheet) &&
          `${r.companyName} ${r.taxPeriod} ${r.taxType} ${r.ntpn} ${r.ntpd} ${r.note}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [records, taxPeriod, taxType, payStatus, sourceSheet, search],
  );
  const companies = [
    ALL,
    ...Array.from(new Set(records.map((r) => r.companyName))).sort(),
  ];
  const periods = [
    ALL,
    ...Array.from(new Set(records.map((r) => r.taxPeriod))).sort(),
  ];
  const sheets = [ALL, ...SOURCE_SHEETS, "Manual"];
  const pageRows =
    active === "ppn"
      ? ppnRecords
      : active === "pph21"
        ? filtered.filter((r) => r.taxType === "PPh 21")
        : active === "unifikasi"
          ? filtered.filter(
              (r) => r.taxType === "PPh 23" || r.taxType === "PPh Final 4(2)",
            )
          : active === "pb1"
            ? filtered.filter((r) => r.taxType === "PB1")
            : active === "umkm"
              ? filtered.filter((r) => r.taxType === "PPh UMKM")
              : filtered;
  const sumType = (type: TaxType) =>
    filtered
      .filter((r) => r.taxType === type)
      .reduce((a, r) => a + r.taxAmount, 0);
  const dppType = (type: TaxType) =>
    filtered.filter((r) => r.taxType === type).reduce((a, r) => a + r.dpp, 0);
  const duplicateNtpn = Object.entries(
    filtered
      .filter(
        (r) =>
          r.ntpn && (r.taxType === "PPh 23" || r.taxType === "PPh Final 4(2)"),
      )
      .reduce(
        (a, r) => ({
          ...a,
          [r.ntpn]: new Set([...(a[r.ntpn] ?? []), r.taxType]),
        }),
        {} as Record<string, Set<string>>,
      ),
  )
    .filter(([, v]) => v.size > 1)
    .map(([k]) => k);
  const resume = Array.from(
    new Map(
      filtered.map((r) => [`${r.companyName}|${r.taxPeriod}|${r.taxType}`, r]),
    ).values(),
  ).map((base) => {
    const group = filtered.filter(
      (r) =>
        r.companyName === base.companyName &&
        r.taxPeriod === base.taxPeriod &&
        r.taxType === base.taxType,
    );
    return {
      perusahaan: base.companyName,
      masaPajak: base.taxPeriod,
      jenisPajak: base.taxType,
      totalDpp: group.reduce((a, r) => a + r.dpp, 0),
      totalPajak: group.reduce((a, r) => a + r.taxAmount, 0),
      ntpnNtptd: group
        .map((r) => r.ntpn || r.ntpd)
        .filter(Boolean)
        .join("; "),
      status: group.some((r) => r.status === "Kompensasi")
        ? "Kompensasi"
        : group.some((r) => r.status === "Lebih Bayar")
          ? "Lebih Bayar"
          : group.every(
                (r) => r.status === "Terverifikasi" || r.status === "Nihil",
              )
            ? "Terverifikasi"
            : "Belum Lengkap",
    };
  });
  function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "array", cellDates: false });
      const imported = wb.SheetNames.filter((s) =>
        SOURCE_SHEETS.includes(s),
      ).flatMap((s) =>
        parseSheet(
          s,
          XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], {
            header: 1,
            blankrows: false,
          }),
        ),
      );
      setRecords((cur) => [...cur, ...imported]);
      setMessage(
        `Import Excel selesai: ${imported.length} tax_records dari sheet ${wb.SheetNames.filter((s) => SOURCE_SHEETS.includes(s)).join(", ")}.`,
      );
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }
  function saveManual(e: FormEvent) {
    e.preventDefault();
    const saved = completeRecord({
      ...draft,
      inputSource: "manual_input",
      sourceSheet: "Manual",
    });
    setRecords((cur) =>
      cur.some((r) => r.id === saved.id)
        ? cur.map((r) => (r.id === saved.id ? saved : r))
        : [saved, ...cur],
    );
    setDraft(blankRecord);
    setFormOpen(false);
  }
  async function uploadPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage("File ditolak: hanya file PDF yang dapat diupload.");
      e.target.value = "";
      return;
    }
    const id = crypto.randomUUID();
    await putPdf(id, file);
    const now = new Date().toISOString();
    setDocuments((cur) => [
      {
        id,
        fileName: file.name,
        fileUrl: `indexeddb://${DOC_STORE}/${id}`,
        fileSize: file.size,
        ...docDraft,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      ...cur,
    ]);
    e.target.value = "";
  }
  const filters = (
    <div className="grid gap-3 lg:grid-cols-7">
      <Select value={company} onChange={(e) => setCompany(e.target.value)}>
        {companies.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <Select value={taxPeriod} onChange={(e) => setTaxPeriod(e.target.value)}>
        {periods.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <Select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
        {[ALL, ...TAX_TYPES].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <Select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
        {[
          ALL,
          "Terverifikasi",
          "Belum Lengkap",
          "Nihil",
          "Lebih Bayar",
          "Kompensasi",
        ].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <Select
        value={sourceSheet}
        onChange={(e) => setSourceSheet(e.target.value)}
      >
        {sheets.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
        />
      </div>
      <Button onClick={() => excelRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Upload Excel
      </Button>
      <Input
        ref={excelRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={importExcel}
        className="hidden"
      />
    </div>
  );
  const sidebar = (
    <aside className="flex h-full flex-col bg-slate-950 p-5 text-white">
      <div className="mb-8 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <div className="rounded-xl bg-blue-600 p-3">
          <ReceiptText />
        </div>
        <div>
          <p className="font-black">Tax Coordinator</p>
          <p className="text-xs text-slate-400">Dashboard Perpajakan</p>
        </div>
      </div>
      <nav className="space-y-1">
        {menus.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              className={cn(
                "menu",
                active === m.id && "bg-blue-600 text-white",
              )}
              onClick={() => {
                setActive(m.id);
                setMobile(false);
              }}
            >
              <Icon className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </nav>
      <p className="mt-auto rounded-xl bg-white/5 p-3 text-xs text-slate-300">
        Data tersimpan permanen di localStorage; PDF disimpan di IndexedDB
        browser.
      </p>
    </aside>
  );
  return (
    <main className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[280px_1fr]">
      <style>{`.menu{display:flex;width:100%;align-items:center;gap:.75rem;border-radius:.75rem;padding:.75rem;text-align:left;font-size:.875rem;font-weight:800;color:#cbd5e1}.menu:hover{background:rgba(255,255,255,.1);color:white}`}</style>
      <div className="hidden lg:block">{sidebar}</div>
      {mobile && (
        <div className="fixed inset-0 z-50 grid grid-cols-[280px_1fr] bg-slate-950/50 lg:hidden">
          {sidebar}
          <button onClick={() => setMobile(false)} className="p-4 text-white">
            <X />
          </button>
        </div>
      )}
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                {menus.find((m) => m.id === active)?.label}
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Dashboard utama berisi resume; detail data berada di sidebar
                jenis pajak.
              </p>
            </div>
          </div>
          {filters}
        </header>
        {message && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
            {message}
          </div>
        )}
        {active === "dashboard" ? (
          <>
            <Cards
              data={[
                ["Total PPN Keluaran", sumType("PPN Keluaran")],
                ["Total PPN Masukan", sumType("PPN Masukan")],
                ["Total PM Tidak Dikreditkan", sumType("PM Tidak Dikreditkan")],
                ["Total Pembayaran PPN", sumType("KB/LB PPN")],
                ["Total PPh Pasal 21", sumType("PPh 21")],
                ["Total PPh Pasal 23", sumType("PPh 23")],
                ["Total PPh Final 4(2)", sumType("PPh Final 4(2)")],
                ["Total PB1", sumType("PB1")],
                ["Total PPh UMKM", sumType("PPh UMKM")],
                [
                  "Total seluruh pembayaran pajak",
                  filtered.reduce((a, r) => a + r.taxAmount, 0),
                ],
                [
                  "Jumlah perusahaan",
                  new Set(filtered.map((r) => r.companyName)).size,
                ],
                [
                  "Jumlah masa pajak",
                  new Set(filtered.map((r) => r.taxPeriod)).size,
                ],
                [
                  "Jumlah NTPN/NTPD terisi",
                  filtered.filter((r) => r.ntpn || r.ntpd).length,
                ],
                [
                  "Belum memiliki NTPN/NTPD",
                  filtered.filter((r) => r.taxAmount && !r.ntpn && !r.ntpd)
                    .length,
                ],
              ]}
            />
            <DataTable
              title="Resume Pembayaran Pajak"
              rows={resume}
              columns={[
                "perusahaan",
                "masaPajak",
                "jenisPajak",
                "totalDpp",
                "totalPajak",
                "ntpnNtptd",
                "status",
              ]}
            />
          </>
        ) : active === "documents" ? (
          <Documents
            documents={documents}
            setDocuments={setDocuments}
            docDraft={docDraft}
            setDocDraft={setDocDraft}
            pdfRef={pdfRef}
            uploadPdf={uploadPdf}
          />
        ) : (
          <>
            <Toolbar
              onAdd={() => {
                setDraft({
                  ...blankRecord,
                  companyName:
                    active === "ppn" ? PPN_COMPANY : blankRecord.companyName,
                  taxType:
                    active === "ppn"
                      ? "PPN Keluaran"
                      : active === "pph21"
                        ? "PPh 21"
                        : active === "pb1"
                          ? "PB1"
                          : active === "umkm"
                            ? "PPh UMKM"
                            : "PPh 23",
                });
                setFormOpen(true);
              }}
              onExport={() => {
                const visibleColumns = columns(active).filter(
                  (c) => c !== "aksi",
                );
                csv(
                  `${active}.csv`,
                  tableRows(active, pageRows, dppType),
                  visibleColumns,
                );
              }}
            />
            {active === "ppn" && (
              <p className="my-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">
                Halaman PPN ini khusus untuk {PPN_COMPANY}. Perhitungan KB/LB =
                PK PPN - PM PPN.
              </p>
            )}
            {formOpen && (
              <ManualForm
                draft={draft}
                setDraft={setDraft}
                onSubmit={saveManual}
                onClose={() => setFormOpen(false)}
                active={active}
              />
            )}{" "}
            {active === "unifikasi" && (
              <p className="my-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                Catatan: NTPN digunakan untuk dua jenis pajak:{" "}
                {duplicateNtpn.join(", ") || "tidak ada pada filter ini"}.
              </p>
            )}
            <Cards
              data={[
                ["Total DPP", pageRows.reduce((a, r) => a + r.dpp, 0)],
                ["Total Pajak", pageRows.reduce((a, r) => a + r.taxAmount, 0)],
                [
                  "Jumlah perusahaan",
                  new Set(pageRows.map((r) => r.companyName)).size,
                ],
                [
                  "NTPN/NTPD terisi",
                  pageRows.filter((r) => r.ntpn || r.ntpd).length,
                ],
                [
                  "Belum lengkap",
                  pageRows.filter((r) => r.status === "Belum Lengkap").length,
                ],
              ]}
            />
            <DataTable
              title={menus.find((m) => m.id === active)?.label ?? "Data"}
              rows={tableRows(active, pageRows, dppType)}
              columns={columns(active)}
              onEdit={(id) => {
                const rec = records.find((r) => r.id === id);
                if (rec) {
                  setDraft(rec);
                  setFormOpen(true);
                }
              }}
              onDelete={(id) =>
                setRecords((cur) => cur.filter((r) => r.id !== id))
              }
            />
          </>
        )}
      </section>
    </main>
  );
}
function tableRows(
  active: MenuId,
  rows: TaxRecord[],
  dppType: (t: TaxType) => number,
) {
  void dppType;
  if (active === "ppn") {
    const groups = Array.from(
      new Map(rows.map((r) => [`${r.companyName}|${r.taxPeriod}`, r])).values(),
    );
    return groups.map((g) => {
      const find = (t: TaxType) =>
        rows.find(
          (r) =>
            r.companyName === g.companyName &&
            r.taxPeriod === g.taxPeriod &&
            r.taxType === t,
        );
      const pkPpn = find("PPN Keluaran")?.taxAmount ?? 0;
      const pmPpn = find("PPN Masukan")?.taxAmount ?? 0;
      const payment =
        find("KB/LB PPN") ?? find("PPN Keluaran") ?? find("PPN Masukan") ?? g;
      return {
        id: payment.id,
        perusahaan: PPN_COMPANY,
        masaPajak: g.taxPeriod,
        pkPpn,
        pmPpn,
        kbLb: pkPpn - pmPpn,
        ntpn: payment.ntpn || payment.ntpd,
        status: payment.status,
      };
    });
  }
  return rows.map((r) => ({
    id: r.id,
    perusahaan: r.companyName,
    masaPajak: r.taxPeriod,
    jenisPajak: r.taxType,
    dpp: r.dpp,
    pajak: r.taxAmount,
    ntpnNtpd: r.ntpn || r.ntpd,
    status: r.status,
  }));
}
function columns(active: MenuId) {
  return active === "ppn"
    ? [
        "perusahaan",
        "masaPajak",
        "pkPpn",
        "pmPpn",
        "kbLb",
        "ntpn",
        "status",
        "aksi",
      ]
    : active === "pph21"
      ? [
          "perusahaan",
          "masaPajak",
          "dpp",
          "pajak",
          "ntpnNtpd",
          "status",
          "aksi",
        ]
      : [
          "perusahaan",
          "masaPajak",
          "jenisPajak",
          "dpp",
          "pajak",
          "ntpnNtpd",
          "status",
          "aksi",
        ];
}
const documentColumns = [
  "fileName",
  "category",
  "companyName",
  "taxPeriod",
  "taxType",
  "uploadedAt",
  "fileSize",
  "fileUrl",
  "aksi",
];
function Cards({ data }: { data: [string, number | string][] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {typeof value === "number" &&
              /total|pajak|dpp|pembayaran/i.test(label)
                ? money(value)
                : value}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
function Toolbar({
  onAdd,
  onExport,
}: {
  onAdd: () => void;
  onExport: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Tambah Data Manual
      </Button>
      <Button variant="outline" onClick={onExport}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
function ManualForm({
  draft,
  setDraft,
  onSubmit,
  onClose,
  active,
}: {
  draft: TaxRecord;
  setDraft: (r: TaxRecord) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  active: MenuId;
}) {
  const allowed =
    active === "unifikasi"
      ? ["PPh 23", "PPh Final 4(2)"]
      : active === "ppn"
        ? ["PPN Keluaran", "PPN Masukan", "PM Tidak Dikreditkan", "KB/LB PPN"]
        : [draft.taxType];
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Form Input Manual</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <Input
            required
            placeholder="Perusahaan"
            value={draft.companyName}
            onChange={(e) =>
              setDraft({ ...draft, companyName: e.target.value })
            }
          />
          <Input
            required
            placeholder="Masa Pajak (Jan-26)"
            value={draft.taxPeriod}
            onChange={(e) => setDraft({ ...draft, taxPeriod: e.target.value })}
          />
          <Select
            value={draft.taxType}
            onChange={(e) =>
              setDraft({ ...draft, taxType: e.target.value as TaxType })
            }
          >
            {allowed.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="DPP"
            value={draft.dpp}
            onChange={(e) =>
              setDraft({ ...draft, dpp: Number(e.target.value) })
            }
          />
          <Input
            type="number"
            placeholder="Pajak"
            value={draft.taxAmount}
            onChange={(e) =>
              setDraft({ ...draft, taxAmount: Number(e.target.value) })
            }
          />
          <Input
            placeholder="NTPN"
            value={draft.ntpn}
            onChange={(e) => setDraft({ ...draft, ntpn: e.target.value })}
          />
          <Input
            placeholder="NTPD/NTPN PB1"
            value={draft.ntpd}
            onChange={(e) => setDraft({ ...draft, ntpd: e.target.value })}
          />
          <Input
            placeholder="Keterangan"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="flex gap-2">
            <Button type="submit">Simpan</Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
function DataTable({
  title,
  rows,
  columns,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length} baris data.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{headerLabel(c)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={String(r.id ?? i)}>
                {columns.map((c) => (
                  <TableCell key={c} className="whitespace-nowrap">
                    {c === "aksi" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit?.(String(r.id))}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete?.(String(r.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : c.toLowerCase().includes("status") ? (
                      <Badge
                        variant={
                          String(r[c]) === "Terverifikasi"
                            ? "success"
                            : String(r[c]) === "Belum Lengkap"
                              ? "warning"
                              : String(r[c]) === "Lebih Bayar"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {String(r[c] ?? "")}
                      </Badge>
                    ) : typeof r[c] === "number" ? (
                      money(r[c] as number)
                    ) : (
                      String(r[c] ?? "")
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
function Documents({
  documents,
  setDocuments,
  docDraft,
  setDocDraft,
  pdfRef,
  uploadPdf,
}: {
  documents: TaxDocument[];
  setDocuments: Dispatch<SetStateAction<TaxDocument[]>>;
  docDraft: {
    category: string;
    companyName: string;
    taxPeriod: string;
    taxType: string;
  };
  setDocDraft: (v: {
    category: string;
    companyName: string;
    taxPeriod: string;
    taxType: string;
  }) => void;
  pdfRef: RefObject<HTMLInputElement | null>;
  uploadPdf: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);
  const list = documents.filter(
    (d) =>
      (cat === ALL || d.category === cat) &&
      `${d.fileName} ${d.companyName} ${d.taxPeriod} ${d.taxType}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Storage Dokumen PDF</CardTitle>
          <CardDescription>
            Upload, validasi PDF, preview, download, delete, search, dan filter
            metadata dokumen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Select
            value={docDraft.category}
            onChange={(e) =>
              setDocDraft({ ...docDraft, category: e.target.value })
            }
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Input
            placeholder="Perusahaan"
            value={docDraft.companyName}
            onChange={(e) =>
              setDocDraft({ ...docDraft, companyName: e.target.value })
            }
          />
          <Input
            placeholder="Masa Pajak"
            value={docDraft.taxPeriod}
            onChange={(e) =>
              setDocDraft({ ...docDraft, taxPeriod: e.target.value })
            }
          />
          <Input
            placeholder="Jenis Pajak"
            value={docDraft.taxType}
            onChange={(e) =>
              setDocDraft({ ...docDraft, taxType: e.target.value })
            }
          />
          <Button onClick={() => pdfRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Upload PDF
          </Button>
          <Input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={uploadPdf}
          />
        </CardContent>
      </Card>
      <div className="my-4 grid gap-3 md:grid-cols-[1fr_240px_auto]">
        <Input
          placeholder="Search dokumen"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          {[ALL, ...DOC_CATEGORIES].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Button
          variant="outline"
          onClick={() =>
            csv(
              "dokumen-pajak.csv",
              list.map((d) => ({
                ...d,
                fileSize: `${(d.fileSize / 1024 / 1024).toFixed(2)} MB`,
              })),
              documentColumns.filter((c) => c !== "aksi"),
            )
          }
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <DataTable
        title="Dokumen Pajak"
        rows={list.map((d) => ({
          ...d,
          fileSize: `${(d.fileSize / 1024 / 1024).toFixed(2)} MB`,
          aksi: d.id,
        }))}
        columns={documentColumns}
        onEdit={async (id) =>
          window.open(await getPdf(id), "_blank", "noopener,noreferrer")
        }
        onDelete={async (id) => {
          await deletePdf(id);
          setDocuments((cur) => cur.filter((d) => d.id !== id));
        }}
      />
      <p className="mt-2 text-sm text-slate-500">
        <Eye className="mr-1 inline h-4 w-4" />
        Tombol edit pada tabel dokumen berfungsi sebagai preview PDF; tombol
        hapus menghapus metadata dan file PDF.
      </p>
    </>
  );
}
