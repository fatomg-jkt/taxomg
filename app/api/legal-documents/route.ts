import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { automaticDocumentStatus, type LegalDocument } from "@/lib/legal-data";
import { backupDashboardState, writeDashboardState } from "@/lib/dashboard-state";
import { uploadDocument } from "@/lib/document-storage";
import { legalDataPathname, readLegalData } from "../legal-data/shared";
const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]), maxSize = 4.5 * 1024 * 1024;
const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "document";
const failure = (error: string, status: number) => NextResponse.json({ ok: false, error, message: error }, { status });
export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return failure("Invalid password", 401);
  try {
    const form = await request.formData(), file = form.get("file"); if (!(file instanceof File) || !file.size) return failure("File dokumen wajib dipilih.", 400);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? ""; if (!allowedExtensions.has(extension)) return failure("Format file tidak didukung.", 400); if (file.size > maxSize) return failure("Ukuran file terlalu besar. Maksimal 4.5 MB untuk upload server.", 413);
    const id = `legal-${crypto.randomUUID()}`, fileName = sanitize(file.name), storagePath = `${id}-${fileName}`, now = new Date().toISOString(), expiredDate = String(form.get("expiredDate") ?? "");
    const metadata = { documentName: String(form.get("documentName") ?? "").trim() || fileName, category: String(form.get("category") ?? "Lainnya"), company: String(form.get("company") ?? ""), documentNumber: String(form.get("documentNumber") ?? ""), documentDate: String(form.get("documentDate") ?? ""), expiredDate, notes: String(form.get("notes") ?? "") };
    const stored = await uploadDocument({ id, bucket: "legal-documents", storage_path: storagePath, original_name: fileName, content_type: file.type || `application/${extension}`, size: file.size, category: "legal-document", metadata }, file);
    const document: LegalDocument = { id, ...metadata, status: automaticDocumentStatus(expiredDate), fileName, fileUrl: `/api/legal-documents/${id}`, fileType: stored.content_type, fileSize: file.size, pathname: storagePath, source: "Upload Document", createdAt: stored.created_at, updatedAt: now };
    const current = await readLegalData(), legalData = { ...current, documents: [document, ...current.documents], lastUpdated: now }; legalData.lastUpdated = await writeDashboardState("legal-data", { legalData }); await backupDashboardState(legalDataPathname, { legalData });
    if (process.env.BLOB_READ_WRITE_TOKEN) try { await put(`legal-documents/${storagePath}`, file, { access: "private", contentType: stored.content_type, addRandomSuffix: false, allowOverwrite: false, token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (error) { console.warn("[legal-documents] Blob backup failed after Supabase upload", error); }
    return NextResponse.json({ ok: true, document, legalData }, { status: 201 });
  } catch (error) { console.error("[legal-documents] Supabase upload failed", error); return failure("Upload Document gagal saat menyimpan file ke Supabase.", 500); }
}
