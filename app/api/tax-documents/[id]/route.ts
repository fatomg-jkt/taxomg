import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { blobOptions, hasBlobConfig, readMetadata } from "../shared";

const missingTokenMessage = "BLOB_READ_WRITE_TOKEN belum tersedia di Vercel Environment Variables.";

type RouteContext = { params: Promise<{ id: string }> };

function contentDisposition(fileName: string, download: boolean) {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "dokumen.pdf";
  const encoded = encodeURIComponent(fileName);
  const disposition = download ? "attachment" : "inline";
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  if (!hasBlobConfig()) {
    console.error("[tax-documents] Missing BLOB_READ_WRITE_TOKEN while reading private PDF.");
    return NextResponse.json({ ok: false, error: missingTokenMessage }, { status: 500 });
  }

  const { id } = await context.params;
  const documents = await readMetadata().catch((error) => {
    console.error("[tax-documents] Failed to read PDF metadata before serving private PDF", error);
    return [];
  });
  const document = documents.find((item) => item.id === id);
  if (!document) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });

  try {
    const result = await get(document.pathname, { access: "private", ...blobOptions() });
    if (result?.statusCode !== 200 || !result.stream) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";
    return new Response(result.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(document.originalName, download),
        "Content-Length": String(document.size),
        "Content-Type": document.type || "application/pdf",
      },
    });
  } catch (error) {
    console.error("[tax-documents] Failed to serve private PDF from Vercel Blob", { id, pathname: document.pathname, error });
    return NextResponse.json({ ok: false, error: "Gagal membuka dokumen PDF." }, { status: 500 });
  }
}
