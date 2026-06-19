export type TaxEntry = {
  id: string;
  perusahaan: string;
  tahun: string;
  masa_pajak: string;
  jenis_pajak: string;
  dpp: number;
  pajak: number;
  ntpn_ntpd?: string;
  tanggal_bayar?: string | null;
  status: string;
  status_auto?: string;
  keterangan?: string;
  source_data: string;
  source_sheet: string;
  source_row?: number;
  upload_batch_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

export async function getDashboardData() {
  return { tax_entries: [] as TaxEntry[], upload_batches: [] as UploadBatch[], mode: "static-file" };
}

export async function createUploadBatch() {
  return { message: "Mode file statis aktif. Riwayat upload dan data pajak disimpan sebagai informasi internal." };
}

export async function createManualEntry(row: Omit<TaxEntry, "id" | "created_at" | "updated_at">) {
  const now = new Date().toISOString();
  return { ...row, id: `manual-${crypto.randomUUID()}`, created_at: now, updated_at: now };
}

export async function updateManualEntry(id: string, row: Partial<TaxEntry>) {
  return { ...row, id, updated_at: new Date().toISOString() };
}

export async function deleteManualEntry(id: string) {
  return { id };
}

export async function deleteUploadBatch(id: string) {
  return { id };
}
