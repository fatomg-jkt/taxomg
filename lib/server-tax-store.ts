export type TaxEntry = {
  id: string;
  perusahaan: string;
  tahun: string;
  masa_pajak: string;
  jenis_pajak: string;
  dpp: number;
  pajak: number;
  ntpn_ntpd: string;
  tanggal_bayar?: string | null;
  status: string;
  status_auto?: string;
  keterangan: string;
  source_data: "Static File" | "Excel Import" | "Manual Input";
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
  uploaded_by?: string;
  status: string;
  error_message: string | null;
};

type Store = { tax_entries: TaxEntry[]; upload_batches: UploadBatch[] };

const modeMessage = "Mode file statis aktif. Data utama dibaca dari /public/data/tax-data.json.";

export async function getDashboardData(): Promise<Store> {
  console.log("[tax-static]", modeMessage);
  return { tax_entries: [], upload_batches: [] };
}

export async function createUploadBatch(batch: Omit<UploadBatch, "id" | "uploaded_at">, entries: Omit<TaxEntry, "id" | "upload_batch_id" | "created_at" | "updated_at">[]) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    batch: { ...batch, id, uploaded_at: now, status: "session-preview", error_message: batch.error_message || null },
    entries: entries.map((entry) => ({ ...entry, id: crypto.randomUUID(), upload_batch_id: id, created_at: now, updated_at: now, source_data: "Excel Import" as const })),
  };
}

export async function createManualEntry(entry: Omit<TaxEntry, "id" | "source_data" | "source_sheet" | "upload_batch_id" | "created_at" | "updated_at">) {
  const now = new Date().toISOString();
  return { ...entry, id: crypto.randomUUID(), source_data: "Manual Input" as const, source_sheet: "Manual Input", upload_batch_id: null, created_at: now, updated_at: now };
}

export async function updateManualEntry(id: string, entry: Partial<TaxEntry>) {
  return { ...entry, id, source_data: "Manual Input" as const, source_sheet: "Manual Input", upload_batch_id: null, updated_at: new Date().toISOString() } as TaxEntry;
}

export async function deleteManualEntry(id?: string) { void id; return true; }
export async function deleteUploadBatch(id?: string) { void id; return true; }
