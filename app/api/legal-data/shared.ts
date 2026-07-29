import { get } from "@vercel/blob";
import { EMPTY_LEGAL_DATA, normalizeLegalData, type LegalData } from "@/lib/legal-data";

export const legalDataPathname = "legal-dashboard-data.json";
export const legalBlobOptions = () => ({ storeId: process.env.TAXOMG_STORE_ID });

export async function readLegalData(): Promise<LegalData> {
  if (!process.env.TAXOMG_STORE_ID) return EMPTY_LEGAL_DATA;
  const result = await get(legalDataPathname, { access: "private", ...legalBlobOptions() });
  if (result?.statusCode !== 200 || !result.stream) return EMPTY_LEGAL_DATA;
  const text = await new Response(result.stream).text();
  if (!text.trim()) return EMPTY_LEGAL_DATA;
  const payload = JSON.parse(text) as { legalData?: Partial<LegalData> } & Partial<LegalData>;
  return normalizeLegalData(payload.legalData ?? payload);
}
