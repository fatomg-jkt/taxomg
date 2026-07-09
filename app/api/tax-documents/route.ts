import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { blobOptions, hasBlobConfig, metadataPathname, readMetadata, type UploadedPdfDocument } from "./shared";

const noStoreHeaders = { "Cache-Control": "no-store" };
const prefix = "tax-documents/";
const privateStoreMismatchMessage = "Konfigurasi akses Vercel Blob tidak sesuai. Store saat ini private.";
const missingTokenMessage = "BLOB_READ_WRITE_TOKEN belum tersedia di Vercel Environment Variables.";

export const dynamic = "force-dynamic";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "dokumen.pdf";
}

function isPdfFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || (!file.type && lowerName.endsWith(".pdf"));
}

function isPrivateStoreMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("cannot use public access on a private store") || message.toLowerCase().includes("private store");
}

async function writeMetadata(documents: UploadedPdfDocument[]) {
  const body = JSON.stringify({ documents, updatedAt: new Date().toISOString() }, null, 2);
  return put(metadataPathname, body, {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...blobOptions(),
  });
}

export async function GET() {
  if (!hasBlobConfig()) return NextResponse.json({ documents: [] }, { headers: noStoreHeaders });

  try {
    const documents = await readMetadata();
    return NextResponse.json({ documents }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[tax-documents] Failed to read PDF metadata from Vercel Blob", error);
    return NextResponse.json({ documents: [] }, { headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  if (!hasBlobConfig()) {
    console.error("[tax-documents] Missing BLOB_READ_WRITE_TOKEN on the server.");
    return NextResponse.json({ ok: false, error: missingTokenMessage }, { status: 500 });
  }

  const formData = await request.formData().catch((error) => {
    console.error("[tax-documents] Failed to parse multipart form data", error);
    return null;
  });
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File PDF wajib dipilih." }, { status: 400 });

  if (!isPdfFile(file)) return NextResponse.json({ ok: false, error: "File harus berformat PDF." }, { status: 400 });

  const uploadedAt = new Date().toISOString();
  const id = `pdf-${crypto.randomUUID()}`;
  const originalName = sanitizeFileName(file.name);
  const pathname = `${prefix}${id}-${originalName}`;

  let blobUrl = "";
  try {
    const blob = await put(pathname, file, {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: false,
      ...blobOptions(),
    });
    blobUrl = blob.url;
  } catch (error) {
    console.error("[tax-documents] Failed to upload PDF to Vercel Blob", { pathname, size: file.size, type: file.type, error });
    return NextResponse.json({ ok: false, error: isPrivateStoreMismatch(error) ? privateStoreMismatchMessage : "Gagal upload ke Vercel Blob." }, { status: 500 });
  }

  const document: UploadedPdfDocument = {
    id,
    originalName,
    name: originalName,
    pathname,
    uploadedAt,
    size: file.size,
    type: file.type || "application/pdf",
    url: blobUrl,
  };

  try {
    const documents = await readMetadata();
    await writeMetadata([document, ...documents]);
  } catch (error) {
    console.error("[tax-documents] Failed to save PDF metadata to Vercel Blob", { document, error });
    return NextResponse.json({ ok: false, error: isPrivateStoreMismatch(error) ? privateStoreMismatchMessage : "Gagal menyimpan metadata dokumen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document }, { status: 201 });
}
