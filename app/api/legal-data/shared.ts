import { EMPTY_LEGAL_DATA, normalizeLegalData, type LegalData } from "@/lib/legal-data";
import { readDashboardState } from "@/lib/supabase-dashboard-state";

export const legalDataPathname = "legal-dashboard-data.json";

export async function readLegalData(): Promise<LegalData> {
  const payload = await readDashboardState<{ legalData: LegalData }>("legal-data", { legalData: EMPTY_LEGAL_DATA });
  return normalizeLegalData(payload.legalData);
}
