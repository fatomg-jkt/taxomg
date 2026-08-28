import { NextResponse } from "next/server";
import { downloadStorageObject, getDocumentMetadata } from "@/lib/supabase-storage-rest";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const document = await getDocumentMetadata(id, "legal", "legal-document");
    if (!document) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

    const result = await downloadStorageObject(document.storage_bucket, document.storage_path);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const safeName = document.original_filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(result.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Length": String(document.size_bytes ?? ""),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.original_filename)}`,
      },
    });
  } catch (error) {
    console.error("[legal-documents] Supabase download failed", { id, error });
    return NextResponse.json({ error: "Gagal membuka dokumen." }, { status: 500 });
  }
}
