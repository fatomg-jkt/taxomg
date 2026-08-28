import { NextResponse } from "next/server";
import { automaticDocumentStatus, type LegalDocument } from "@/lib/legal-data";
import { insertDocumentMetadata, uploadStorageObject } from "@/lib/supabase-storage-rest";
import { writeDashboardState } from "@/lib/supabase-dashboard-state";
import { readLegalData } from "../legal-data/shared";

const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]);
const maxServerUploadSize = 4.5 * 1024 * 1024;
const bucket = "legal-documents";
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

    const fileName = sanitize(file.name);
    const storagePath = `${new Date().getFullYear()}/${crypto.randomUUID()}-${fileName}`;
    await uploadStorageObject(bucket, storagePath, file);

    const now = new Date().toISOString();
    const documentDate = String(form.get("documentDate") ?? "");
    const expiredDate = String(form.get("expiredDate") ?? "");
    const company = String(form.get("company") ?? "");
    const documentName = String(form.get("documentName") ?? "").trim() || fileName;
    const category = String(form.get("category") ?? "Lainnya");
    const documentNumber = String(form.get("documentNumber") ?? "");
    const notes = String(form.get("notes") ?? "");

    const metadataRow = await insertDocumentMetadata({
      module: "legal",
      category: "legal-document",
      company: company || null,
      original_filename: fileName,
      storage_bucket: bucket,
      storage_path: storagePath,
      mime_type: file.type || `application/${extension}`,
      size_bytes: file.size,
      document_date: /^\d{4}-\d{2}-\d{2}$/.test(documentDate) ? documentDate : null,
      metadata: { documentName, category, documentNumber, expiredDate, notes },
    });

    const document: LegalDocument = {
      id: metadataRow.id,
      documentName,
      category,
      company,
      documentNumber,
      documentDate,
      expiredDate,
      status: automaticDocumentStatus(expiredDate),
      fileName,
      fileUrl: `/api/legal-documents/${metadataRow.id}`,
      fileType: file.type || `application/${extension}`,
      fileSize: file.size,
      pathname: storagePath,
      notes,
      source: "Upload Document",
      createdAt: now,
      updatedAt: now,
    };

    const current = await readLegalData();
    const legalData = { ...current, documents: [document, ...(current.documents ?? [])], lastUpdated: now };
    legalData.lastUpdated = await writeDashboardState("legal-data", { legalData });
    return NextResponse.json({ ok: true, document, legalData, storage: "supabase" }, { status: 201 });
  } catch (error) {
    console.error("[legal-documents] Supabase upload failed", error);
    return errorResponse("Upload Document gagal saat menyimpan file ke Supabase.", 500);
  }
}
