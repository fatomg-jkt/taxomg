import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { blobNotConfiguredMessage, hasLegalBlobConfiguration, legalBlobOptions, readLegalData } from "../../legal-data/shared";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasLegalBlobConfiguration()) return NextResponse.json({ error: blobNotConfiguredMessage, message: blobNotConfiguredMessage }, { status: 500 });
  const { id } = await params;
  const document = (await readLegalData()).documents.find((item) => item.id === id);
  if (!document?.pathname) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  const result = await get(document.pathname, { access: "private", ...legalBlobOptions() });
  if (result?.statusCode !== 200 || !result.stream) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = document.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(result.stream, { headers: { "Cache-Control": "private, no-store", "Content-Type": document.fileType || "application/octet-stream", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}` } });
}
