import { get } from "@vercel/blob";

export const metadataPathname = "documents-pdf.json";

export type UploadedPdfDocument = {
  id: string;
  originalName: string;
  name: string;
  pathname: string;
  uploadedAt: string;
  size: number;
  type: string;
  url: string;
};

type DocumentsPayload = { documents?: Partial<UploadedPdfDocument>[] };

export function blobOptions() {
  return { token: process.env.BLOB_READ_WRITE_TOKEN };
}

export function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function readMetadata(): Promise<UploadedPdfDocument[]> {
  return readPrivateMetadata();
}

async function readPrivateMetadata(): Promise<UploadedPdfDocument[]> {
  const result = await get(metadataPathname, { access: "private", ...blobOptions() });
  if (result?.statusCode !== 200 || !result.stream) return [];

  const text = await new Response(result.stream).text();
  if (!text.trim()) return [];

  const payload = JSON.parse(text) as DocumentsPayload;
  return normalizeDocuments(payload);
}

function normalizeDocuments(payload: DocumentsPayload): UploadedPdfDocument[] {
  return Array.isArray(payload.documents)
    ? payload.documents.flatMap((doc) => {
        if (!doc?.id) return [];
        const originalName = doc.originalName || doc.name;
        const pathname = doc.pathname;
        if (!originalName || !pathname) return [];
        return [{
          id: doc.id,
          originalName,
          name: doc.name || originalName,
          pathname,
          uploadedAt: doc.uploadedAt || "",
          size: Number(doc.size || 0),
          type: doc.type || "application/pdf",
          url: doc.url || "",
        }];
      })
    : [];
}
