export const COMPANY_STATUSES = ["Aktif", "Tidak Aktif", "Perlu Update", "Belum Beroperasi", "Dalam Proses"] as const;
export const RELATION_TYPES = ["Holding", "Subsidiary", "Brand", "Entity", "Management", "Partnership", "Lainnya"] as const;
export const STRUCTURE_STATUSES = ["Aktif", "Tidak Aktif", "Dalam Proses", "Perlu Review"] as const;
export const DOCUMENT_CATEGORIES = ["Akta Perusahaan", "SK Kemenkumham", "NPWP", "NIB", "Izin Usaha", "Domisili", "PKP", "Perjanjian", "Kontrak", "Surat Kuasa", "Lainnya"] as const;
export const DOCUMENT_STATUSES = ["Aktif", "Expired", "Akan Expired", "Perlu Update", "Dalam Proses"] as const;

export type CompanyProfile = {
  id: string; companyName: string; brandGroup: string; businessField: string;
  establishmentDeed: string; amendmentDeed: string; operationStartDate: string;
  npwp: string; npwpd: string; skpkp: string; nib: string; kbli: string;
  kemenkumhamApproval: string; director: string; commissioner: string;
  shareholders: string; status: string; notes: string;
  source: "Excel Import" | "Manual Input"; createdAt: string; updatedAt: string;
  /** Legacy fields retained so previously saved profiles remain readable. */
  businessType?: string; address?: string;
};
export type CorporateStructure = { id: string; parentHolding: string; brandGroup: string; entity: string; relationType: string; ownershipPercentage: string; status: string; notes: string; createdAt: string; updatedAt: string };
export type LegalDocument = { id: string; documentName: string; category: string; company: string; documentNumber: string; documentDate: string; expiredDate: string; status: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; pathname?: string; notes: string; source: "Upload Document"; createdAt: string; updatedAt: string };
export type LegalData = { companyProfiles: CompanyProfile[]; corporateStructures: CorporateStructure[]; documents: LegalDocument[]; lastUpdated: string };

export const EMPTY_LEGAL_DATA: LegalData = { companyProfiles: [], corporateStructures: [], documents: [], lastUpdated: "" };

export function normalizeLegalData(value: Partial<LegalData> | null | undefined): LegalData {
  return {
    companyProfiles: Array.isArray(value?.companyProfiles) ? value.companyProfiles.map((profile) => ({
      ...profile,
      businessField: profile.businessField ?? profile.businessType ?? "",
      establishmentDeed: profile.establishmentDeed ?? "", amendmentDeed: profile.amendmentDeed ?? "",
      operationStartDate: profile.operationStartDate ?? "", npwp: profile.npwp ?? "", npwpd: profile.npwpd ?? "",
      skpkp: profile.skpkp ?? "", nib: profile.nib ?? "", kbli: profile.kbli ?? "",
      kemenkumhamApproval: profile.kemenkumhamApproval ?? "", director: profile.director ?? "",
      commissioner: profile.commissioner ?? "", shareholders: profile.shareholders ?? "",
      notes: profile.notes ?? "", source: profile.source ?? "Manual Input",
    })) : [],
    corporateStructures: Array.isArray(value?.corporateStructures) ? value.corporateStructures : [],
    documents: Array.isArray(value?.documents) ? value.documents.map((document) => ({
      ...document,
      fileSize: typeof document.fileSize === "number" ? document.fileSize : 0,
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
