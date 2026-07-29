export const COMPANY_STATUSES = ["Aktif", "Tidak Aktif", "Perlu Update", "Dalam Proses"] as const;
export const RELATION_TYPES = ["Holding", "Subsidiary", "Brand", "Entity", "Management", "Partnership", "Lainnya"] as const;
export const STRUCTURE_STATUSES = ["Aktif", "Tidak Aktif", "Dalam Proses", "Perlu Review"] as const;
export const DOCUMENT_CATEGORIES = ["Akta Perusahaan", "SK Kemenkumham", "NPWP", "NIB", "Izin Usaha", "Domisili", "PKP", "Perjanjian", "Kontrak", "Surat Kuasa", "Lainnya"] as const;
export const DOCUMENT_STATUSES = ["Aktif", "Expired", "Akan Expired", "Perlu Update", "Dalam Proses"] as const;

export type CompanyProfile = { id: string; companyName: string; brandGroup: string; businessType: string; npwp: string; nib: string; address: string; status: string; notes: string; createdAt: string; updatedAt: string };
export type CorporateStructure = { id: string; parentHolding: string; brandGroup: string; entity: string; relationType: string; ownershipPercentage: string; status: string; notes: string; createdAt: string; updatedAt: string };
export type LegalDocument = { id: string; documentName: string; category: string; company: string; documentNumber: string; documentDate: string; expiredDate: string; status: string; fileName: string; fileUrl: string; fileType: string; pathname?: string; notes: string; source: "Upload Document"; createdAt: string; updatedAt: string };
export type LegalData = { companyProfiles: CompanyProfile[]; corporateStructures: CorporateStructure[]; documents: LegalDocument[]; lastUpdated: string };

export const EMPTY_LEGAL_DATA: LegalData = { companyProfiles: [], corporateStructures: [], documents: [], lastUpdated: "" };

export function normalizeLegalData(value: Partial<LegalData> | null | undefined): LegalData {
  return {
    companyProfiles: Array.isArray(value?.companyProfiles) ? value.companyProfiles : [],
    corporateStructures: Array.isArray(value?.corporateStructures) ? value.corporateStructures : [],
    documents: Array.isArray(value?.documents) ? value.documents.map((document) => ({
      ...document,
      status: ["Aktif", "Expired", "Akan Expired"].includes(document.status) ? automaticDocumentStatus(document.expiredDate) : document.status || automaticDocumentStatus(document.expiredDate),
    })) : [],
    lastUpdated: typeof value?.lastUpdated === "string" ? value.lastUpdated : "",
  };
}

export function automaticDocumentStatus(expiredDate: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiredDate)) return "Aktif";
  const expiry = new Date(`${expiredDate}T00:00:00`);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(expiry.getTime())) return "Aktif";
  const days = Math.ceil((expiry.getTime() - current.getTime()) / 86_400_000);
  if (days < 0) return "Expired";
  return days <= 30 ? "Akan Expired" : "Aktif";
}
