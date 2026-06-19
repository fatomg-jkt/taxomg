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
  uploaded_by?: string;
  status: string;
  error_message: string | null;
};

type Store = { tax_entries: TaxEntry[]; upload_batches: UploadBatch[] };
type SupabaseError = { message?: string; details?: string; hint?: string; code?: string };

const tableNames = { entries: "tax_entries", batches: "upload_batches" } as const;

function envStatus() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log("[tax-db] Environment variable availability", envStatus());
  console.log("[tax-db] Tables", tableNames);
  if (!url) throw new Error("Supabase URL belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL di Vercel lalu redeploy project.");
  if (!key) throw new Error("Supabase key belum dikonfigurasi. Tambahkan SUPABASE_SERVICE_ROLE_KEY untuk API route server atau NEXT_PUBLIC_SUPABASE_ANON_KEY lalu redeploy project.");
  return { url: url.replace(/\/$/, ""), key };
}

function formatSupabaseError(error: SupabaseError | string) {
  if (typeof error === "string") return error;
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ") || "Koneksi database gagal.";
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  console.log("[tax-db] Supabase response", { path, status: response.status, ok: response.ok, payload });
  if (!response.ok) throw new Error(formatSupabaseError(payload as SupabaseError));
  return payload as T;
}

function withEntryDefaults(entry: Partial<TaxEntry>): TaxEntry {
  const now = new Date().toISOString();
  return {
    id: entry.id || crypto.randomUUID(),
    perusahaan: entry.perusahaan || "Perusahaan Belum Diisi",
    tahun: entry.tahun || String(new Date().getFullYear()),
    masa_pajak: entry.masa_pajak || "-",
    jenis_pajak: entry.jenis_pajak || "PPh Pasal 21",
    dpp: Number(entry.dpp) || 0,
    pajak: Number(entry.pajak) || 0,
    ntpn_ntpd: entry.ntpn_ntpd || "",
    tanggal_bayar: entry.tanggal_bayar || null,
    status: entry.status || "Belum Lengkap",
    status_auto: entry.status_auto || "",
    keterangan: entry.keterangan || "",
    source_data: entry.source_data || "Manual Input",
    source_sheet: entry.source_sheet || (entry.source_data === "Excel Import" ? "Excel" : "Manual Input"),
    source_row: entry.source_row || 0,
    upload_batch_id: entry.upload_batch_id ?? null,
    created_at: entry.created_at || now,
    updated_at: now,
  };
}

export async function getDashboardData(): Promise<Store> {
  const [tax_entries, upload_batches] = await Promise.all([
    supabaseFetch<TaxEntry[]>(`${tableNames.entries}?select=*&order=created_at.desc`),
    supabaseFetch<UploadBatch[]>(`${tableNames.batches}?select=*&order=uploaded_at.desc`),
  ]);
  return { tax_entries, upload_batches };
}

export async function createUploadBatch(batch: Omit<UploadBatch, "id" | "uploaded_at">, entries: Omit<TaxEntry, "id" | "upload_batch_id" | "created_at" | "updated_at">[]) {
  const id = crypto.randomUUID();
  const nextBatch = { ...batch, id, status: batch.status || "success", error_message: batch.error_message || null };
  console.log("[tax-db] Creating upload batch", { batch: nextBatch, entriesCount: entries.length });
  const [createdBatch] = await supabaseFetch<UploadBatch[]>(tableNames.batches, { method: "POST", body: JSON.stringify(nextBatch) });
  try {
    const rows = entries.map((entry) => withEntryDefaults({ ...entry, id: crypto.randomUUID(), source_data: "Excel Import", upload_batch_id: id }));
    console.log("[tax-db] Inserting upload entries", { table: tableNames.entries, rows });
    const createdEntries = rows.length ? await supabaseFetch<TaxEntry[]>(tableNames.entries, { method: "POST", body: JSON.stringify(rows) }) : [];
    return { batch: createdBatch, entries: createdEntries };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[tax-db] Upload entries insert failed", error);
    await supabaseFetch<UploadBatch[]>(`${tableNames.batches}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_message: message }) });
    throw error;
  }
}

export async function createManualEntry(entry: Omit<TaxEntry, "id" | "source_data" | "source_sheet" | "upload_batch_id" | "created_at" | "updated_at">) {
  const row = withEntryDefaults({ ...entry, source_data: "Manual Input", source_sheet: "Manual Input", upload_batch_id: null });
  console.log("[tax-db] Inserting manual entry", { table: tableNames.entries, row });
  const [created] = await supabaseFetch<TaxEntry[]>(tableNames.entries, { method: "POST", body: JSON.stringify(row) });
  return created;
}

export async function updateManualEntry(id: string, entry: Partial<TaxEntry>) {
  const row = withEntryDefaults({ ...entry, id, source_data: "Manual Input", source_sheet: "Manual Input", upload_batch_id: null });
  console.log("[tax-db] Updating manual entry", { table: tableNames.entries, id, row });
  const rows = await supabaseFetch<TaxEntry[]>(`${tableNames.entries}?id=eq.${id}&source_data=eq.Manual%20Input`, { method: "PATCH", body: JSON.stringify(row) });
  return rows[0] ?? null;
}

export async function deleteManualEntry(id: string) {
  console.log("[tax-db] Deleting manual entry", { table: tableNames.entries, id });
  const rows = await supabaseFetch<TaxEntry[]>(`${tableNames.entries}?id=eq.${id}&source_data=eq.Manual%20Input`, { method: "DELETE" });
  return rows.length > 0;
}

export async function deleteUploadBatch(id: string) {
  console.log("[tax-db] Deleting upload batch", { table: tableNames.batches, id });
  const rows = await supabaseFetch<UploadBatch[]>(`${tableNames.batches}?id=eq.${id}`, { method: "DELETE" });
  return rows.length > 0;
}
