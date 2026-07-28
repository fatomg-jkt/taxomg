export type UserRole = "OWNER" | "SUPER_ADMIN" | "TAX_USER" | "FINANCE_USER";

export type UserAccess = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

// Konfigurasi akun dipusatkan di sini agar mudah diganti oleh administrator.
export const USER_ACCESS: readonly UserAccess[] = [
  { name: "Owner", email: "owner@company.com", password: "owner123", role: "OWNER" },
  { name: "Super Admin", email: "superadmin@company.com", password: "superadmin123", role: "SUPER_ADMIN" },
  { name: "Tax", email: "tax@company.com", password: "tax123", role: "TAX_USER" },
  { name: "Finance", email: "finance@company.com", password: "finance123", role: "FINANCE_USER" },
] as const;

export type DashboardArea = "tax" | "finance";

export const AUTH_STORAGE_KEY = "authSession";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return USER_ACCESS.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null;
}

export function validateLogin(email: string, password: string) {
  const user = getUserByEmail(email);
  if (!user || user.password !== password) return null;
  return user;
}

export function getUserRole(email: string): UserRole | null {
  return getUserByEmail(email)?.role ?? null;
}

export const getRoleForEmail = getUserRole;

export function canAccessTax(role: UserRole) {
  return role === "OWNER" || role === "SUPER_ADMIN" || role === "TAX_USER";
}

export function canAccessFinance(role: UserRole) {
  return role === "OWNER" || role === "SUPER_ADMIN" || role === "FINANCE_USER";
}

export function canAccessArea(role: UserRole, area: DashboardArea) {
  return area === "tax" ? canAccessTax(role) : canAccessFinance(role);
}

const FINANCE_PAGES = new Set([
  "financeOverview", "financeDetails", "financeDevices", "financeObsidian", "finance1001",
  "financeResto", "cashflow", "cashflowProjection", "cashflowActual",
]);

export function canAccessPage(role: UserRole, page: string) {
  return FINANCE_PAGES.has(page) ? canAccessFinance(role) : canAccessTax(role);
}
