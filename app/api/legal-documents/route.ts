import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { automaticDocumentStatus, type LegalDocument } from "@/lib/legal-data";
import { blobNotConfiguredMessage, hasLegalBlobConfiguration, legalBlobOptions, legalDataPathname, readLegalData } from "../legal-data/shared";

const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]);
const maxServerUploadSize = 4.5 * 1024 * 1024;
const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "document";
const errorResponse = (message: string, status: number) => NextResponse.json({ ok: false, error: message, message }, { status });

export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return errorResponse("Invalid password", 401);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return errorResponse("File dokumen wajib dipilih.", 400);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension)) return errorResponse("Format file tidak didukung.", 400);
    if (file.size > maxServerUploadSize) return errorResponse("Ukuran file terlalu besar. Maksimal 4.5 MB untuk upload server.", 413);
    if (!hasLegalBlobConfiguration()) {
      console.error("[legal-documents] Upload rejected because Vercel Blob credentials are not configured.");
      return errorResponse(blobNotConfiguredMessage, 500);
    }

    const id = `legal-${crypto.randomUUID()}`;
    const fileName = sanitize(file.name);
    const pathname = `legal-documents/${id}-${fileName}`;
    await put(pathname, file, { access: "private", contentType: file.type || "application/octet-stream", addRandomSuffix: false, allowOverwrite: false, ...legalBlobOptions() });
    const now = new Date().toISOString();
    const expiredDate = String(form.get("expiredDate") ?? "");
    const document: LegalDocument = { id, documentName: String(form.get("documentName") ?? "").trim() || fileName, category: String(form.get("category") ?? "Lainnya"), company: String(form.get("company") ?? ""), documentNumber: String(form.get("documentNumber") ?? ""), documentDate: String(form.get("documentDate") ?? ""), expiredDate, status: automaticDocumentStatus(expiredDate), fileName, fileUrl: `/api/legal-documents/${id}`, fileType: file.type || `application/${extension}`, fileSize: file.size, pathname, notes: String(form.get("notes") ?? ""), source: "Upload Document", createdAt: now, updatedAt: now };
    const current = await readLegalData();
    const legalData = { ...current, documents: [document, ...(current.documents ?? [])], lastUpdated: now };
    await put(legalDataPathname, JSON.stringify({ legalData }, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, ...legalBlobOptions() });
    return NextResponse.json({ ok: true, document, legalData }, { status: 201 });
  } catch (error) {
    console.error("[legal-documents] Vercel Blob upload failed", error);
    return errorResponse("Upload Document gagal saat menyimpan file ke Vercel Blob.", 500);
  }
}
