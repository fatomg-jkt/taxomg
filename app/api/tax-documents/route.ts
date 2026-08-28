import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { uploadDocument } from "@/lib/document-storage";
import { readMetadata } from "./shared";
const headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";
const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "dokumen.pdf";
export async function GET() { try { return NextResponse.json({ documents: await readMetadata() }, { headers }); } catch (error) { console.error("[tax-documents] Supabase read failed", error); return NextResponse.json({ error: "Gagal membaca dokumen pajak dari Supabase." }, { status: 500, headers }); } }
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File PDF wajib dipilih." }, { status: 400 });
  if (file.type !== "application/pdf" && !(!file.type && file.name.toLowerCase().endsWith(".pdf"))) return NextResponse.json({ ok: false, error: "File harus berformat PDF." }, { status: 400 });
  const id = `pdf-${crypto.randomUUID()}`, originalName = sanitize(file.name), storagePath = `${id}-${originalName}`;
  try {
    const stored = await uploadDocument({ id, bucket: "tax-documents", storage_path: storagePath, original_name: originalName, content_type: file.type || "application/pdf", size: file.size, category: "tax-document", metadata: {} }, file);
    if (process.env.BLOB_READ_WRITE_TOKEN) try { await put(`tax-documents/${storagePath}`, file, { access: "private", contentType: stored.content_type, addRandomSuffix: false, allowOverwrite: false, token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (error) { console.warn("[tax-documents] Blob backup failed after Supabase upload", error); }
    return NextResponse.json({ ok: true, document: { id, originalName, name: originalName, pathname: storagePath, uploadedAt: stored.created_at, size: file.size, type: stored.content_type, url: `/api/tax-documents/${id}` } }, { status: 201 });
  } catch (error) { console.error("[tax-documents] Supabase upload failed", error); return NextResponse.json({ ok: false, error: "Gagal upload dokumen pajak ke Supabase." }, { status: 500 }); }
}
