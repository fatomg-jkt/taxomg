export type Company = "All Companies" | "PT Nusantara Retail" | "PT Garuda Manufacturing" | "PT Samudra Logistics" | "PT Digital UMKM";
export type TaxStatus = "Filed" | "In Review" | "Due Soon" | "Missing Docs" | "Overdue";

export type TaxStatusRow = {
  id: string;
  taxType: string;
  period: string;
  dueDate: string;
  status: TaxStatus;
  amount: number;
  company: Exclude<Company, "All Companies">;
};

export type VatCalculation = {
  id: string;
  company: Exclude<Company, "All Companies">;
  taxPeriod: string;
  outputVat: number;
  inputVat: number;
  kbLb: number;
  ntpn: string;
};

export type TaxDocument = {
  id: string;
  name: string;
  company: Exclude<Company, "All Companies">;
  type: "XML" | "Excel" | "PDF";
  status: "Validated" | "Needs Review" | "Missing" | "Archived";
  updatedAt: string;
};

export const companies: Company[] = ["All Companies", "PT Nusantara Retail", "PT Garuda Manufacturing", "PT Samudra Logistics", "PT Digital UMKM"];
export const periods = ["May 2026", "April 2026", "March 2026", "February 2026", "January 2026"];

const baseCompanies = companies.filter((company): company is Exclude<Company, "All Companies"> => company !== "All Companies");

export function generateTaxStatusRows(): TaxStatusRow[] {
  const taxTypes = ["PPN", "PPh Pasal 21", "PPh Unifikasi", "PBB", "UMKM"];
  const statuses: TaxStatus[] = ["Filed", "In Review", "Due Soon", "Missing Docs", "Overdue"];

  return baseCompanies.flatMap((company, companyIndex) =>
    taxTypes.map((taxType, taxIndex) => ({
      id: `${companyIndex}-${taxType}`,
      taxType,
      period: periods[(companyIndex + taxIndex) % periods.length],
      dueDate: new Date(2026, 5, 10 + companyIndex * 3 + taxIndex).toISOString(),
      status: statuses[(companyIndex * 2 + taxIndex) % statuses.length],
      amount: 42_000_000 + companyIndex * 31_500_000 + taxIndex * 14_250_000,
      company,
    })),
  );
}

export function generateVatCalculations(): VatCalculation[] {
  return baseCompanies.flatMap((company, companyIndex) =>
    periods.slice(0, 4).map((taxPeriod, periodIndex) => {
      const outputVat = 720_000_000 + companyIndex * 155_000_000 - periodIndex * 38_000_000;
      const inputVat = 515_000_000 + companyIndex * 103_000_000 - periodIndex * 26_500_000;
      return {
        id: `${companyIndex}-${periodIndex}`,
        company,
        taxPeriod,
        outputVat,
        inputVat,
        kbLb: outputVat - inputVat,
        ntpn: periodIndex % 3 === 0 ? "Pending" : `NTPN-${companyIndex + 21}${periodIndex}8${companyIndex}`,
      };
    }),
  );
}

export function generateDocuments(): TaxDocument[] {
  const statuses: TaxDocument["status"][] = ["Validated", "Needs Review", "Missing", "Archived"];
  const types: TaxDocument["type"][] = ["XML", "Excel", "PDF"];

  return baseCompanies.flatMap((company, companyIndex) =>
    types.map((type, typeIndex) => ({
      id: `${companyIndex}-doc-${type}`,
      name: `${type === "XML" ? "e-Faktur" : type === "Excel" ? "VAT Reconciliation" : "Bukti Potong"} ${periods[typeIndex]}`,
      company,
      type,
      status: statuses[(companyIndex + typeIndex) % statuses.length],
      updatedAt: new Date(2026, 5, 1 + companyIndex + typeIndex).toISOString(),
    })),
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: Math.abs(value) > 999_999_999 ? "compact" : "standard",
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
