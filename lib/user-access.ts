export type UserRole = "OWNER" | "SUPER_ADMIN" | "TAX_USER" | "FINANCE_USER";

export type UserAccess = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UserDirectoryEntry = Omit<UserAccess, "password"> & { id?: string };

// Konfigurasi akun default. Perubahan dari menu Pengaturan User disimpan terpisah di cloud.
export const USER_ACCESS: readonly UserAccess[] = [
  { name: "Owner", email: "owner", password: "owner123", role: "OWNER" },
  { name: "Super Admin", email: "superadmin", password: "superadmin123", role: "SUPER_ADMIN" },
  { name: "Tax", email: "tax", password: "tax123", role: "TAX_USER" },
  { name: "Finance", email: "finance", password: "finance123", role: "FINANCE_USER" },
] as const;

export type DashboardArea = "tax" | "finance" | "legal";

export const AUTH_STORAGE_KEY = "authSession";
export const USER_DIRECTORY_STORAGE_KEY = "taxomg-user-directory-v1";

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@company.com") ? normalized.slice(0, -"@company.com".length) : normalized;
}

function cachedDirectory(): UserDirectoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(USER_DIRECTORY_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((user) => user && typeof user.email === "string" && typeof user.role === "string") : [];
  } catch {
    return [];
  }
}

export function getUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const cached = cachedDirectory().find((user) => normalizeEmail(user.email) === normalizedEmail);
  if (cached) return { ...cached, email: normalizeEmail(cached.email), password: "" } satisfies UserAccess;
  return USER_ACCESS.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null;
}

export function validateLogin(email: string, password: string) {
  // Bila direktori cloud sudah pernah dimuat, login ditangani controller server-side
  // agar password hasil pengaturan tidak perlu disimpan di browser.
  if (cachedDirectory().length) return null;
  const user = USER_ACCESS.find((item) => normalizeEmail(item.email) === normalizeEmail(email));
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

export function canAccessLegal(role: UserRole) {
  return role === "OWNER" || role === "SUPER_ADMIN";
}

export function canAccessArea(role: UserRole, area: DashboardArea) {
  if (area === "legal") return canAccessLegal(role);
  return area === "tax" ? canAccessTax(role) : canAccessFinance(role);
}

const FINANCE_PAGES = new Set([
  "financeOverview", "financeDetails", "financeDevices", "financeObsidian", "finance1001",
  "financeResto", "cashflow", "cashflowProjection", "cashflowActual",
]);

export function canAccessPage(role: UserRole, page: string) {
  if (page.startsWith("legal")) return canAccessLegal(role);
  return FINANCE_PAGES.has(page) ? canAccessFinance(role) : canAccessTax(role);
}
