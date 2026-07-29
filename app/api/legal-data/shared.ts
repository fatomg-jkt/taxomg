import { get } from "@vercel/blob";
import { EMPTY_LEGAL_DATA, normalizeLegalData, type LegalData } from "@/lib/legal-data";

export const legalDataPathname = "legal-dashboard-data.json";
export const blobNotConfiguredMessage = "Vercel Blob belum dikonfigurasi. Periksa environment variable Blob.";

export function hasLegalBlobConfiguration() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.VERCEL_OIDC_TOKEN && (process.env.BLOB_STORE_ID || process.env.TAXOMG_STORE_ID)),
  );
}

export function legalBlobOptions() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return { token: process.env.BLOB_READ_WRITE_TOKEN };
  return {
    oidcToken: process.env.VERCEL_OIDC_TOKEN,
    storeId: process.env.BLOB_STORE_ID || process.env.TAXOMG_STORE_ID,
  };
}

export async function readLegalData(): Promise<LegalData> {
  if (!hasLegalBlobConfiguration()) return EMPTY_LEGAL_DATA;
  const result = await get(legalDataPathname, { access: "private", ...legalBlobOptions() });
  if (result?.statusCode !== 200 || !result.stream) return EMPTY_LEGAL_DATA;
  const text = await new Response(result.stream).text();
  if (!text.trim()) return EMPTY_LEGAL_DATA;
  const payload = JSON.parse(text) as { legalData?: Partial<LegalData> } & Partial<LegalData>;
  return normalizeLegalData(payload.legalData ?? payload);
}
