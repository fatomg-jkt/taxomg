import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { USER_ACCESS, type UserRole } from "@/lib/user-access";

const fileName = "taxomg-user-access.json";
const noStoreHeaders = { "Cache-Control": "no-store" };
const roles: UserRole[] = ["OWNER", "SUPER_ADMIN", "TAX_USER", "FINANCE_USER"];

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
};

function normalizeUserId(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.endsWith("@company.com") ? normalized.slice(0, -"@company.com".length) : normalized;
}

function isValidUserId(value: string) {
  return /^[a-z0-9._-]{2,50}$/.test(value);
}

function passwordHash(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function makeStoredUser(user: { id?: string; name: string; email: string; role: UserRole; password: string }): StoredUser {
  const salt = randomBytes(16).toString("hex");
  return {
    id: user.id || crypto.randomUUID(),
    name: String(user.name || "User").trim() || "User",
    email: normalizeUserId(user.email),
    role: user.role,
    salt,
    passwordHash: passwordHash(user.password, salt),
  };
}

function defaultUsers(): StoredUser[] {
  return USER_ACCESS.map((user) => makeStoredUser(user));
}

function normalizeStoredUsers(users: StoredUser[]) {
  return users.map((user) => ({ ...user, email: normalizeUserId(user.email) }));
}

async function loadUsers(): Promise<StoredUser[]> {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return defaultUsers();
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return defaultUsers();
    const text = await new Response(result.stream).text();
    const payload = JSON.parse(text);
    if (!Array.isArray(payload?.users) || !payload.users.length) return defaultUsers();
    return normalizeStoredUsers(payload.users.filter((user: StoredUser) => user && user.email && user.passwordHash && user.salt && roles.includes(user.role)));
  } catch {
    return defaultUsers();
  }
}

async function saveUsers(users: StoredUser[]) {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) throw new Error("Missing TAXOMG_STORE_ID");
  await put(fileName, JSON.stringify({ users, updatedAt: new Date().toISOString() }, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    storeId,
  });
}

function publicUsers(users: StoredUser[]) {
  return users.map(({ id, name, email, role }) => ({ id, name, email: normalizeUserId(email), role }));
}

function checkPassword(user: StoredUser | undefined, password: string) {
  if (!user || !password) return false;
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(passwordHash(password, user.salt), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET() {
  const users = await loadUsers();
  return NextResponse.json({ users: publicUsers(users) }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const users = await loadUsers();

  if (body.action === "login") {
    const email = normalizeUserId(body.email);
    const user = users.find((item) => normalizeUserId(item.email) === email);
    if (!checkPassword(user, String(body.password ?? ""))) {
      return NextResponse.json({ ok: false, error: "User ID atau password salah." }, { status: 401, headers: noStoreHeaders });
    }
    return NextResponse.json({ ok: true, user: { id: user!.id, name: user!.name, email: normalizeUserId(user!.email), role: user!.role } }, { headers: noStoreHeaders });
  }

  if (body.action === "save") {
    const actorEmail = normalizeUserId(body.actorEmail);
    const actor = users.find((item) => normalizeUserId(item.email) === actorEmail);
    if (!checkPassword(actor, String(body.actorPassword ?? "")) || !actor || !["OWNER", "SUPER_ADMIN"].includes(actor.role)) {
      return NextResponse.json({ ok: false, error: "Hanya Owner/Super Admin dengan password yang valid yang dapat mengubah user." }, { status: 403, headers: noStoreHeaders });
    }
    if (!Array.isArray(body.users) || !body.users.length) {
      return NextResponse.json({ ok: false, error: "Daftar user kosong." }, { status: 400, headers: noStoreHeaders });
    }

    const emails = new Set<string>();
    const nextUsers: StoredUser[] = [];
    for (const draft of body.users) {
      const email = normalizeUserId(draft.email);
      const role = draft.role as UserRole;
      if (!email || !isValidUserId(email) || emails.has(email) || !roles.includes(role)) {
        return NextResponse.json({ ok: false, error: "Pastikan User ID unik, 2-50 karakter, dan hanya memakai huruf, angka, titik, garis bawah, atau tanda minus." }, { status: 400, headers: noStoreHeaders });
      }
      emails.add(email);
      const existing = users.find((item) => item.id === draft.id || normalizeUserId(item.email) === email);
      const password = String(draft.password ?? "");
      if (!existing && password.length < 6) {
        return NextResponse.json({ ok: false, error: `Password untuk ${email} minimal 6 karakter.` }, { status: 400, headers: noStoreHeaders });
      }
      if (existing && !password) {
        nextUsers.push({ ...existing, name: String(draft.name || existing.name).trim() || existing.name, email, role });
      } else {
        nextUsers.push(makeStoredUser({ id: existing?.id || String(draft.id || ""), name: String(draft.name || "User"), email, role, password }));
      }
    }

    if (!nextUsers.some((user) => user.role === "OWNER")) {
      return NextResponse.json({ ok: false, error: "Minimal harus ada satu user dengan role OWNER." }, { status: 400, headers: noStoreHeaders });
    }

    await saveUsers(nextUsers);
    return NextResponse.json({ ok: true, users: publicUsers(nextUsers) }, { headers: noStoreHeaders });
  }

  return NextResponse.json({ ok: false, error: "Action tidak valid." }, { status: 400, headers: noStoreHeaders });
}
