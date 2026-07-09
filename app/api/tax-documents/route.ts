import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "no-store" };
const prefix = "tax-documents/";

export const dynamic = "force-dynamic";

type BlobListItem = {
  pathname: string;
  url: string;
  downloadUrl?: string;
  size?: number;
  uploadedAt?: Date | string;
};

function storeId() {
  return process.env.TAXOMG_STORE_ID;
}

function documentName(pathname: string) {
  const withoutPrefix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const parts = withoutPrefix.split("-");
  return decodeURIComponent(parts.length > 1 ? parts.slice(1).join("-") : withoutPrefix);
}

function mapBlob(blob: BlobListItem) {
  return {
    id: blob.pathname,
    name: documentName(blob.pathname),
    uploadedAt: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : null,
    size: blob.size ?? 0,
    url: blob.downloadUrl ?? blob.url,
  };
}

export async function GET() {
  const currentStoreId = storeId();
  if (!currentStoreId) return NextResponse.json({ documents: [] }, { headers: noStoreHeaders });

  try {
    const result = await list({ prefix, storeId: currentStoreId });
    return NextResponse.json({ documents: result.blobs.map(mapBlob) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[tax-documents] Failed to list PDF documents", error);
    return NextResponse.json({ documents: [] }, { headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const currentStoreId = storeId();
  if (!currentStoreId) return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File PDF wajib dipilih." }, { status: 400 });

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return NextResponse.json({ ok: false, error: "Upload ditolak. Hanya file PDF (.pdf) yang diperbolehkan." }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const pathname = `${prefix}${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
    allowOverwrite: false,
    storeId: currentStoreId,
  });

  return NextResponse.json({ ok: true, document: mapBlob({ pathname, url: blob.url, size: file.size, uploadedAt: new Date().toISOString() }) }, { status: 201 });
}
