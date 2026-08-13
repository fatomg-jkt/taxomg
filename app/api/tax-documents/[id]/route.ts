import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { downloadFileFromOneDrive, isOneDriveConfigured, oneDriveItemId } from "@/lib/onedrive-storage";
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
    console.error("[tax-documents] Missing BLOB_READ_WRITE_TOKEN while reading document metadata.");
    return NextResponse.json({ ok: false, error: missingTokenMessage }, { status: 500 });
  }

  const { id } = await context.params;
  const documents = await readMetadata().catch((error) => {
    console.error("[tax-documents] Failed to read PDF metadata before serving document", error);
    return [];
  });
  const document = documents.find((item) => item.id === id);
  if (!document) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });

  try {
    const oneDriveId = oneDriveItemId(document.pathname);
    const result = oneDriveId
      ? (isOneDriveConfigured() ? await downloadFileFromOneDrive(oneDriveId) : null)
      : await get(document.pathname, { access: "private", ...blobOptions() });

    if (!result) return NextResponse.json({ ok: false, error: "OneDrive belum dikonfigurasi pada server." }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";

    if (oneDriveId) {
      const oneDriveResponse = result as Response;
      if (!oneDriveResponse.ok || !oneDriveResponse.body) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });
      return new Response(oneDriveResponse.body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": contentDisposition(document.originalName, download),
          "Content-Type": document.type || "application/pdf",
        },
      });
    }

    const blobResult = result as Awaited<ReturnType<typeof get>>;
    if (blobResult?.statusCode !== 200 || !blobResult.stream) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });
    return new Response(blobResult.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(document.originalName, download),
        "Content-Length": String(document.size),
        "Content-Type": document.type || "application/pdf",
      },
    });
  } catch (error) {
    console.error("[tax-documents] Failed to serve private PDF", { id, pathname: document.pathname, error });
    return NextResponse.json({ ok: false, error: "Gagal membuka dokumen PDF." }, { status: 500 });
  }
}
