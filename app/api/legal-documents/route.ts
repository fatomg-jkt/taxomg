import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { automaticDocumentStatus, type LegalDocument } from "@/lib/legal-data";
import { legalBlobOptions, legalDataPathname, readLegalData } from "../legal-data/shared";

const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]);
const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "document";

export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  if (!process.env.TAXOMG_STORE_ID) return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, error: "File dokumen wajib dipilih." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) return NextResponse.json({ ok: false, error: "Format file tidak didukung." }, { status: 400 });
  const id = `legal-${crypto.randomUUID()}`;
  const fileName = sanitize(file.name);
  const pathname = `legal-documents/${id}-${fileName}`;
  await put(pathname, file, { access: "private", contentType: file.type || "application/octet-stream", addRandomSuffix: false, allowOverwrite: false, ...legalBlobOptions() });
  const now = new Date().toISOString();
  const expiredDate = String(form?.get("expiredDate") ?? "");
  const document: LegalDocument = { id, documentName: String(form?.get("documentName") ?? "").trim() || fileName, category: String(form?.get("category") ?? "Lainnya"), company: String(form?.get("company") ?? ""), documentNumber: String(form?.get("documentNumber") ?? ""), documentDate: String(form?.get("documentDate") ?? ""), expiredDate, status: automaticDocumentStatus(expiredDate), fileName, fileUrl: `/api/legal-documents/${id}`, fileType: file.type || `application/${extension}`, pathname, notes: String(form?.get("notes") ?? ""), source: "Upload Document", createdAt: now, updatedAt: now };
  const current = await readLegalData();
  const legalData = { ...current, documents: [document, ...(current.documents ?? [])], lastUpdated: now };
  await put(legalDataPathname, JSON.stringify({ legalData }, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, ...legalBlobOptions() });
  return NextResponse.json({ ok: true, document, legalData }, { status: 201 });
}
