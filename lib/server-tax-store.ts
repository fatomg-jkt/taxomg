import { promises as fs } from "fs";
import path from "path";

export type TaxEntry = {
  id: string;
  perusahaan: string;
  tahun: string;
  masa_pajak: string;
  jenis_pajak: string;
  dpp: number;
  pajak: number;
  ntpn_ntpd: string;
  tanggal_bayar?: string;
  status: string;
  status_auto?: string;
  keterangan: string;
  source_data: "Excel Import" | "Manual Input";
  source_sheet: string;
  source_row?: number;
  upload_batch_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadBatch = {
  id: string;
  file_name: string;
  uploaded_at: string;
  total_rows: number;
  uploaded_by: string;
  status: string;
  error_message: string;
};

type Store = { tax_entries: TaxEntry[]; upload_batches: UploadBatch[] };
const dataFile = path.join(process.cwd(), ".data", "tax-dashboard.json");

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { tax_entries: parsed.tax_entries ?? [], upload_batches: parsed.upload_batches ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { tax_entries: [], upload_batches: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
}

export async function getDashboardData() { return readStore(); }

export async function createUploadBatch(batch: Omit<UploadBatch, "id" | "uploaded_at">, entries: Omit<TaxEntry, "id" | "upload_batch_id" | "created_at" | "updated_at">[]) {
  const store = await readStore();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const nextBatch: UploadBatch = { ...batch, id, uploaded_at: now };
  const nextEntries: TaxEntry[] = entries.map((entry) => ({ ...entry, id: crypto.randomUUID(), upload_batch_id: id, created_at: now, updated_at: now }));
  store.upload_batches.unshift(nextBatch);
  store.tax_entries.push(...nextEntries);
  await writeStore(store);
  return { batch: nextBatch, entries: nextEntries };
}

export async function createManualEntry(entry: Omit<TaxEntry, "id" | "source_data" | "source_sheet" | "upload_batch_id" | "created_at" | "updated_at">) {
  const store = await readStore();
  const now = new Date().toISOString();
  const next: TaxEntry = { ...entry, id: crypto.randomUUID(), source_data: "Manual Input", source_sheet: "Manual Input", upload_batch_id: null, created_at: now, updated_at: now };
  store.tax_entries.push(next);
  await writeStore(store);
  return next;
}

export async function updateManualEntry(id: string, entry: Partial<TaxEntry>) {
  const store = await readStore();
  const index = store.tax_entries.findIndex((row) => row.id === id && row.source_data === "Manual Input");
  if (index < 0) return null;
  store.tax_entries[index] = { ...store.tax_entries[index], ...entry, id, source_data: "Manual Input", source_sheet: "Manual Input", upload_batch_id: null, updated_at: new Date().toISOString() };
  await writeStore(store);
  return store.tax_entries[index];
}

export async function deleteManualEntry(id: string) {
  const store = await readStore();
  const before = store.tax_entries.length;
  store.tax_entries = store.tax_entries.filter((row) => !(row.id === id && row.source_data === "Manual Input"));
  await writeStore(store);
  return store.tax_entries.length !== before;
}

export async function deleteUploadBatch(id: string) {
  const store = await readStore();
  const before = store.upload_batches.length;
  store.upload_batches = store.upload_batches.filter((batch) => batch.id !== id);
  store.tax_entries = store.tax_entries.filter((row) => row.upload_batch_id !== id);
  await writeStore(store);
  return store.upload_batches.length !== before;
}
