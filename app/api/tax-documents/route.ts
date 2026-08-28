import { NextResponse } from "next/server";
import { insertDocumentMetadata, uploadStorageObject } from "@/lib/supabase-storage-rest";
import { readMetadata, type UploadedPdfDocument } from "./shared";

const noStoreHeaders = { "Cache-Control": "no-store" };
const bucket = "tax-documents";
export const dynamic = "force-dynamic";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "dokumen.pdf";
}

function isPdfFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || (!file.type && lowerName.endsWith(".pdf"));
}

export async function GET() {
  try {
    return NextResponse.json({ documents: await readMetadata() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[tax-documents] Supabase metadata read failed", error);
    return NextResponse.json({ ok: false, error: "Gagal membaca dokumen pajak dari Supabase." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const formData = await request.formData().catch((error) => {
    console.error("[tax-documents] Failed to parse multipart form data", error);
    return null;
  });
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File PDF wajib dipilih." }, { status: 400 });
  if (!isPdfFile(file)) return NextResponse.json({ ok: false, error: "File harus berformat PDF." }, { status: 400 });

  const originalName = sanitizeFileName(file.name);
  const storagePath = `${new Date().getFullYear()}/${crypto.randomUUID()}-${originalName}`;

  try {
    await uploadStorageObject(bucket, storagePath, file);
    const row = await insertDocumentMetadata({
      module: "tax",
      category: "tax-document",
      original_filename: originalName,
      storage_bucket: bucket,
      storage_path: storagePath,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      metadata: {},
    });
    const document: UploadedPdfDocument = {
      id: row.id,
      originalName: row.original_filename,
      name: row.original_filename,
      pathname: row.storage_path,
      uploadedAt: row.created_at,
      size: Number(row.size_bytes ?? 0),
      type: row.mime_type || "application/pdf",
      url: `/api/tax-documents/${row.id}`,
    };
    return NextResponse.json({ ok: true, document, storage: "supabase" }, { status: 201 });
  } catch (error) {
    console.error("[tax-documents] Supabase upload failed", error);
    return NextResponse.json({ ok: false, error: "Gagal upload dokumen pajak ke Supabase." }, { status: 500 });
  }
}
