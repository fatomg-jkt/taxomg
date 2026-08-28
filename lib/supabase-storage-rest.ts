type StoredDocumentRow = {
  id: string;
  module: string;
  category: string;
  company: string | null;
  brand: string | null;
  related_record_id: string | null;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_date: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
};

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

function authHeaders(extra?: HeadersInit) {
  const { key } = getConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function encodePath(path: string) {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

async function errorText(response: Response) {
  return (await response.text().catch(() => "")) || `${response.status} ${response.statusText}`;
}

export async function uploadStorageObject(bucket: string, path: string, file: File) {
  const { url } = getConfig();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    }),
    body: file,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase Storage upload failed: ${await errorText(response)}`);
  return response.json().catch(() => ({}));
}

export async function downloadStorageObject(bucket: string, path: string) {
  const { url } = getConfig();
  const response = await fetch(`${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase Storage download failed: ${await errorText(response)}`);
  return response;
}

export async function insertDocumentMetadata(input: {
  id?: string;
  module: string;
  category: string;
  company?: string | null;
  brand?: string | null;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  document_date?: string | null;
  metadata?: Record<string, unknown>;
  uploaded_by?: string | null;
}) {
  const { url } = getConfig();
  const response = await fetch(`${url}/rest/v1/documents`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase document metadata insert failed: ${await errorText(response)}`);
  const rows = (await response.json()) as StoredDocumentRow[];
  if (!rows[0]) throw new Error("Supabase document metadata insert returned no row");
  return rows[0];
}

export async function listDocumentMetadata(module: string, category: string) {
  const { url } = getConfig();
  const endpoint = `${url}/rest/v1/documents?module=eq.${encodeURIComponent(module)}&category=eq.${encodeURIComponent(category)}&select=*&order=created_at.desc`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: authHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase document metadata read failed: ${await errorText(response)}`);
  return (await response.json()) as StoredDocumentRow[];
}

export async function getDocumentMetadata(id: string, module?: string, category?: string) {
  const { url } = getConfig();
  const filters = [`id=eq.${encodeURIComponent(id)}`];
  if (module) filters.push(`module=eq.${encodeURIComponent(module)}`);
  if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
  const endpoint = `${url}/rest/v1/documents?${filters.join("&")}&select=*&limit=1`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: authHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase document metadata read failed: ${await errorText(response)}`);
  const rows = (await response.json()) as StoredDocumentRow[];
  return rows[0] ?? null;
}
