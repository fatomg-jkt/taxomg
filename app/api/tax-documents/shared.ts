import { listDocumentMetadata } from "@/lib/supabase-storage-rest";

export type UploadedPdfDocument = {
  id: string;
  originalName: string;
  name: string;
  pathname: string;
  uploadedAt: string;
  size: number;
  type: string;
  url: string;
};

export async function readMetadata(): Promise<UploadedPdfDocument[]> {
  const rows = await listDocumentMetadata("tax", "tax-document");
  return rows.map((row) => ({
    id: row.id,
    originalName: row.original_filename,
    name: row.original_filename,
    pathname: row.storage_path,
    uploadedAt: row.created_at,
    size: Number(row.size_bytes ?? 0),
    type: row.mime_type || "application/pdf",
    url: `/api/tax-documents/${row.id}`,
  }));
}
