import { NextResponse } from "next/server";
import { downloadStorageObject, getDocumentMetadata } from "@/lib/supabase-storage-rest";

type RouteContext = { params: Promise<{ id: string }> };

function contentDisposition(fileName: string, download: boolean) {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "dokumen.pdf";
  const encoded = encodeURIComponent(fileName);
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const document = await getDocumentMetadata(id, "tax", "tax-document");
    if (!document) return NextResponse.json({ ok: false, error: "Dokumen PDF tidak ditemukan." }, { status: 404 });
    const response = await downloadStorageObject(document.storage_bucket, document.storage_path);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(response.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(document.original_filename, download),
        "Content-Length": String(document.size_bytes ?? ""),
        "Content-Type": document.mime_type || "application/pdf",
      },
    });
  } catch (error) {
    console.error("[tax-documents] Supabase document read failed", { id, error });
    return NextResponse.json({ ok: false, error: "Gagal membuka dokumen PDF." }, { status: 500 });
  }
}
