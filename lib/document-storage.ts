import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

export type StoredDocument = {
  id: string;
  bucket: string;
  storage_path: string;
  original_name: string;
  content_type: string;
  size: number;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listDocuments(category: string) {
  const { data, error } = await getSupabaseServerClient().from("documents").select("*").eq("category", category).order("created_at", { ascending: false });
  if (error) throw new Error(`Supabase gagal membaca metadata dokumen: ${error.message}`);
  return (data ?? []) as StoredDocument[];
}

export async function getDocument(id: string, category: string) {
  const { data, error } = await getSupabaseServerClient().from("documents").select("*").eq("id", id).eq("category", category).maybeSingle();
  if (error) throw new Error(`Supabase gagal membaca metadata dokumen: ${error.message}`);
  return data as StoredDocument | null;
}

export async function uploadDocument(input: Omit<StoredDocument, "created_at">, file: File) {
  const supabase = getSupabaseServerClient();
  const { error: uploadError } = await supabase.storage.from(input.bucket).upload(input.storage_path, file, { contentType: input.content_type, upsert: false });
  if (uploadError) throw new Error(`Supabase Storage gagal mengunggah file: ${uploadError.message}`);
  const createdAt = new Date().toISOString();
  const { error: metadataError } = await supabase.from("documents").insert({ ...input, created_at: createdAt });
  if (metadataError) {
    await supabase.storage.from(input.bucket).remove([input.storage_path]);
    throw new Error(`Supabase gagal menyimpan metadata dokumen: ${metadataError.message}`);
  }
  return { ...input, created_at: createdAt };
}

export async function createDocumentSignedUrl(document: StoredDocument) {
  const { data, error } = await getSupabaseServerClient().storage.from(document.bucket).createSignedUrl(document.storage_path, 60);
  if (error || !data?.signedUrl) throw new Error(`Supabase Storage gagal membuat signed URL: ${error?.message ?? "URL tidak tersedia"}`);
  return data.signedUrl;
}
