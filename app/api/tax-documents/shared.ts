import { listDocuments } from "@/lib/document-storage";
export type UploadedPdfDocument = { id: string; originalName: string; name: string; pathname: string; uploadedAt: string; size: number; type: string; url: string };
export async function readMetadata(): Promise<UploadedPdfDocument[]> {
  return (await listDocuments("tax-document")).map((document) => ({ id: document.id, originalName: document.original_name, name: document.original_name, pathname: document.storage_path, uploadedAt: document.created_at, size: document.size, type: document.content_type, url: `/api/tax-documents/${document.id}` }));
}
