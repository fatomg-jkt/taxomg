export const USER_ACCESS = {
  superAdmin: ["owner@company.com"],
  finance: ["finance@company.com"],
  tax: ["tax@company.com"],
} as const;

export type UserRole = "SUPER_ADMIN" | "FINANCE_USER" | "TAX_USER";

export type DashboardArea = "tax" | "finance";

export const AUTH_STORAGE_KEY = "taxomg-dashboard-user";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getRoleForEmail(email: string): UserRole | null {
  const normalizedEmail = normalizeEmail(email);

  if (USER_ACCESS.superAdmin.some((allowedEmail) => normalizeEmail(allowedEmail) === normalizedEmail)) {
    return "SUPER_ADMIN";
  }
  if (USER_ACCESS.finance.some((allowedEmail) => normalizeEmail(allowedEmail) === normalizedEmail)) {
    return "FINANCE_USER";
  }
  if (USER_ACCESS.tax.some((allowedEmail) => normalizeEmail(allowedEmail) === normalizedEmail)) {
    return "TAX_USER";
  }

  return null;
}

export function canAccessArea(role: UserRole, area: DashboardArea) {
  return role === "SUPER_ADMIN" || (role === "FINANCE_USER" && area === "finance") || (role === "TAX_USER" && area === "tax");
}
