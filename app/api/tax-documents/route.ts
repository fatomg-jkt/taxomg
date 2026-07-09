import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "no-store" };
const prefix = "tax-documents/";
const metadataPathname = "documents-pdf.json";

export const dynamic = "force-dynamic";

type UploadedPdfDocument = {
  id: string;
  name: string;
  uploadedAt: string;
  size: number;
  type: string;
  url: string;
};

type DocumentsPayload = { documents?: UploadedPdfDocument[] };

function blobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.TAXOMG_STORE_ID;
  return { token, storeId };
}

function hasBlobConfig() {
  const { token, storeId } = blobOptions();
  return Boolean(token || storeId);
}

function blobConfigError() {
  return process.env.BLOB_READ_WRITE_TOKEN ? "Konfigurasi Blob belum tersedia." : "Token Blob belum tersedia.";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "dokumen.pdf";
}

function isPdfFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || (!file.type && lowerName.endsWith(".pdf"));
}

function normalizeDocuments(payload: DocumentsPayload): UploadedPdfDocument[] {
  return Array.isArray(payload.documents)
    ? payload.documents.filter((doc) => doc && doc.id && doc.name && doc.url)
    : [];
}

async function readMetadata(): Promise<UploadedPdfDocument[]> {
  const options = blobOptions();
  const result = await get(metadataPathname, { access: "private", ...options });
  if (result?.statusCode !== 200 || !result.stream) return [];

  const text = await new Response(result.stream).text();
  if (!text.trim()) return [];

  const payload = JSON.parse(text) as DocumentsPayload;
  return normalizeDocuments(payload);
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
    console.error("[tax-documents] Missing Vercel Blob configuration. Set BLOB_READ_WRITE_TOKEN or TAXOMG_STORE_ID on the server.");
    return NextResponse.json({ ok: false, error: blobConfigError() }, { status: 500 });
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
  const safeName = sanitizeFileName(file.name);
  const pathname = `${prefix}${id}-${safeName}`;

  let blobUrl = "";
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: false,
      ...blobOptions(),
    });
    blobUrl = blob.url;
  } catch (error) {
    console.error("[tax-documents] Failed to upload PDF to Vercel Blob", { pathname, size: file.size, type: file.type, error });
    return NextResponse.json({ ok: false, error: "Gagal upload ke Vercel Blob." }, { status: 500 });
  }

  const document: UploadedPdfDocument = {
    id,
    name: safeName,
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
    return NextResponse.json({ ok: false, error: "Gagal menyimpan metadata dokumen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document }, { status: 201 });
}
