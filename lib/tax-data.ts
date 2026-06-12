export type Company = "All Companies" | "PT Nusantara Retail" | "PT Garuda Manufacturing" | "PT Samudra Logistics" | "PT Digital UMKM";
export type TaxPeriod = "May 2026" | "April 2026" | "March 2026" | "February 2026" | "January 2026";
export type CompanyName = Exclude<Company, "All Companies">;
export type FilingStatus = "Draft" | "In Review" | "Filed" | "Due Soon" | "Overdue" | "Missing Docs";
export type PaymentStatus = "Draft" | "In Review" | "Paid" | "Due Soon" | "Overdue" | "Missing Docs";
export type TaxStatus = FilingStatus | PaymentStatus;
export type DocumentCategory = "Invoice" | "Tax Return" | "Payment Proof" | "Bupot" | "NTPN" | "Other";
export type DocumentStatus = "Missing" | "Requested" | "Received" | "Verified" | "Archived";

export interface BaseRecord {
  id: string;
  company: CompanyName;
  notes: string;
  updatedAt: string;
}

export interface PPNRecord extends BaseRecord {
  taxPeriod: TaxPeriod;
  ppnOutput: number;
  ppnInput: number;
  kbLb: number;
  nonCreditableVat: number;
  dueDate: string;
  filingStatus: FilingStatus;
  paymentStatus: PaymentStatus;
  ntpn: string;
}

export interface PPh21Record extends BaseRecord {
  taxPeriod: TaxPeriod;
  employeeCount: number;
  grossPayroll: number;
  taxableIncome: number;
  pph21Payable: number;
  dueDate: string;
  filingStatus: FilingStatus;
  paymentStatus: PaymentStatus;
  ntpn: string;
}

export interface PPhUnifikasiRecord extends BaseRecord {
  taxPeriod: TaxPeriod;
  taxObject: string;
  counterparty: string;
  dpp: number;
  taxRate: number;
  pphAmount: number;
  bupotNumber: string;
  dueDate: string;
  filingStatus: FilingStatus;
  paymentStatus: PaymentStatus;
  ntpn: string;
}

export interface PBBRecord extends BaseRecord {
  propertyName: string;
  propertyAddress: string;
  nop: string;
  taxYear: string;
  njop: number;
  pbbPayable: number;
  dueDate: string;
  paymentStatus: PaymentStatus;
  ntpn: string;
}

export interface UMKMRecord extends BaseRecord {
  taxPeriod: TaxPeriod;
  revenue: number;
  taxRate: number;
  finalTaxPayable: number;
  dueDate: string;
  filingStatus: FilingStatus;
  paymentStatus: PaymentStatus;
  ntpn: string;
}

export interface TaxDocumentRecord extends BaseRecord {
  taxType: "PPN" | "PPh Pasal 21" | "PPh Unifikasi" | "PBB" | "UMKM";
  taxPeriod: TaxPeriod;
  documentName: string;
  documentCategory: DocumentCategory;
  documentStatus: DocumentStatus;
  referenceNumber: string;
}

export interface TaxDatabase {
  ppn: PPNRecord[];
  pph21: PPh21Record[];
  pphUnifikasi: PPhUnifikasiRecord[];
  pbb: PBBRecord[];
  umkm: UMKMRecord[];
  taxDocuments: TaxDocumentRecord[];
}

export const companies: Company[] = ["All Companies", "PT Nusantara Retail", "PT Garuda Manufacturing", "PT Samudra Logistics", "PT Digital UMKM"];
export const companyNames = companies.filter((company): company is CompanyName => company !== "All Companies");
export const periods: TaxPeriod[] = ["May 2026", "April 2026", "March 2026", "February 2026", "January 2026"];
export const filingStatuses: FilingStatus[] = ["Draft", "In Review", "Filed", "Due Soon", "Overdue", "Missing Docs"];
export const paymentStatuses: PaymentStatus[] = ["Draft", "In Review", "Paid", "Due Soon", "Overdue", "Missing Docs"];
export const documentCategories: DocumentCategory[] = ["Invoice", "Tax Return", "Payment Proof", "Bupot", "NTPN", "Other"];
export const documentStatuses: DocumentStatus[] = ["Missing", "Requested", "Received", "Verified", "Archived"];

const now = "2026-06-12T08:00:00.000Z";

export const seedTaxData: TaxDatabase = {
  ppn: companyNames.map((company, index) => {
    const output = 720_000_000 + index * 120_000_000;
    const input = 510_000_000 + index * 90_000_000;
    return {
      id: `ppn-${index + 1}`,
      company,
      taxPeriod: periods[index % periods.length],
      ppnOutput: output,
      ppnInput: input,
      kbLb: output - input,
      nonCreditableVat: 18_000_000 + index * 4_500_000,
      dueDate: `2026-06-${10 + index}`,
      filingStatus: ["Filed", "In Review", "Due Soon", "Missing Docs"][index] as FilingStatus,
      paymentStatus: ["Paid", "In Review", "Due Soon", "Overdue"][index] as PaymentStatus,
      ntpn: index === 0 ? "NTPN-PPN-260501" : "",
      notes: "Seed manual VAT reconciliation data.",
      updatedAt: now,
    };
  }),
  pph21: companyNames.map((company, index) => ({
    id: `pph21-${index + 1}`,
    company,
    taxPeriod: periods[index % periods.length],
    employeeCount: 84 + index * 37,
    grossPayroll: 1_800_000_000 + index * 420_000_000,
    taxableIncome: 1_150_000_000 + index * 360_000_000,
    pph21Payable: 95_000_000 + index * 28_000_000,
    dueDate: `2026-06-${12 + index}`,
    filingStatus: ["Filed", "Filed", "Due Soon", "Overdue"][index] as FilingStatus,
    paymentStatus: ["Paid", "Paid", "Due Soon", "Overdue"][index] as PaymentStatus,
    ntpn: index < 2 ? `NTPN-P21-26050${index}` : "",
    notes: "Payroll withholding manual entry.",
    updatedAt: now,
  })),
  pphUnifikasi: companyNames.map((company, index) => ({
    id: `unifikasi-${index + 1}`,
    company,
    taxPeriod: periods[index % periods.length],
    taxObject: ["Rent", "Professional Service", "Dividend", "Royalty"][index],
    counterparty: ["PT Office Properti", "KAP Cermat", "PT Investor Lokal", "CV Kreatif Lisensi"][index],
    dpp: 320_000_000 + index * 85_000_000,
    taxRate: [10, 2, 15, 15][index],
    pphAmount: [32_000_000, 8_100_000, 73_500_000, 86_250_000][index],
    bupotNumber: `BUPOT-UNI-2605${index}`,
    dueDate: `2026-06-${13 + index}`,
    filingStatus: ["Filed", "In Review", "Due Soon", "Missing Docs"][index] as FilingStatus,
    paymentStatus: ["Paid", "In Review", "Due Soon", "Missing Docs"][index] as PaymentStatus,
    ntpn: index === 0 ? "NTPN-UNI-260500" : "",
    notes: "Withholding tax object tracked manually.",
    updatedAt: now,
  })),
  pbb: companyNames.map((company, index) => ({
    id: `pbb-${index + 1}`,
    company,
    propertyName: ["Gudang Barat", "Pabrik Karawang", "Hub Tanjung Priok", "Kantor Digital"][index],
    propertyAddress: ["Jl. Merdeka 10", "KIIC Lot A-7", "Jl. Pelabuhan 3", "Jl. Startup 88"][index],
    nop: `31.71.0${index}.001.00${index}.000${index}.0`,
    taxYear: "2026",
    njop: 9_500_000_000 + index * 1_750_000_000,
    pbbPayable: 48_000_000 + index * 12_500_000,
    dueDate: `2026-08-${15 + index}`,
    paymentStatus: ["Paid", "In Review", "Due Soon", "Draft"][index] as PaymentStatus,
    ntpn: index === 0 ? "NTPN-PBB-2026-01" : "",
    notes: "Property tax payable based on SPPT.",
    updatedAt: now,
  })),
  umkm: companyNames.map((company, index) => ({
    id: `umkm-${index + 1}`,
    company,
    taxPeriod: periods[index % periods.length],
    revenue: 680_000_000 + index * 72_000_000,
    taxRate: 0.5,
    finalTaxPayable: 3_400_000 + index * 360_000,
    dueDate: `2026-06-${14 + index}`,
    filingStatus: ["Filed", "In Review", "Due Soon", "Draft"][index] as FilingStatus,
    paymentStatus: ["Paid", "In Review", "Due Soon", "Draft"][index] as PaymentStatus,
    ntpn: index === 0 ? "NTPN-UMKM-260501" : "",
    notes: "Final tax on qualifying gross revenue.",
    updatedAt: now,
  })),
  taxDocuments: companyNames.flatMap((company, companyIndex) => [
    {
      id: `doc-${companyIndex + 1}-1`,
      company,
      taxType: "PPN" as const,
      taxPeriod: periods[companyIndex % periods.length],
      documentName: `e-Faktur ${periods[companyIndex % periods.length]}`,
      documentCategory: "Invoice" as const,
      documentStatus: ["Verified", "Received", "Requested", "Missing"][companyIndex] as DocumentStatus,
      referenceNumber: `DOC-PPN-2605${companyIndex}`,
      notes: "Manual document tracker item.",
      updatedAt: now,
    },
    {
      id: `doc-${companyIndex + 1}-2`,
      company,
      taxType: "PPh Unifikasi" as const,
      taxPeriod: periods[companyIndex % periods.length],
      documentName: `Bukti Potong ${periods[companyIndex % periods.length]}`,
      documentCategory: "Bupot" as const,
      documentStatus: ["Archived", "Verified", "Received", "Requested"][companyIndex] as DocumentStatus,
      referenceNumber: `DOC-BUPOT-2605${companyIndex}`,
      notes: "Evidence tracked without mandatory upload.",
      updatedAt: now,
    },
  ]),
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
