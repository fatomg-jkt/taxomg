"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { TaxCoordinatorDashboard } from "@/components/tax-coordinator-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_STORAGE_KEY, normalizeEmail, type UserRole } from "@/lib/user-access";

type UserSession = { name: string; email: string; role: UserRole; loginTime: string };

type LoginPayload = {
  ok?: boolean;
  error?: string;
  user?: { name?: string; email?: string; role?: UserRole };
};

const VALID_ROLES: UserRole[] = ["OWNER", "SUPER_ADMIN", "TAX_USER", "FINANCE_USER"];

function readSession(): UserSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<UserSession>;
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.loginTime !== "string" ||
      !parsed.role ||
      !VALID_ROLES.includes(parsed.role)
    ) return null;
    return {
      name: parsed.name,
      email: normalizeEmail(parsed.email),
      role: parsed.role,
      loginTime: parsed.loginTime,
    };
  } catch {
    return null;
  }
}

export function DashboardAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const storedSession = readSession();
    if (!storedSession) localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(storedSession);
    setReady(true);
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUserId = normalizeEmail(userId);

    if (!normalizedUserId) {
      setError("User ID wajib diisi.");
      return;
    }
    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setLoggingIn(true);
    setError("");
    try {
      const response = await fetch("/api/user-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: normalizedUserId, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginPayload;

      if (!response.ok || !payload.ok || !payload.user?.email || !payload.user.role) {
        setError(payload.error || "User ID atau password salah.");
        return;
      }

      const nextSession: UserSession = {
        name: payload.user.name || normalizedUserId,
        email: normalizeEmail(payload.user.email),
        role: payload.user.role,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch {
      setError("Login gagal terhubung ke server. Silakan coba lagi.");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    setUserId("");
    setPassword("");
    setSession(null);
  }

  if (!ready) return <main className="min-h-screen bg-[#EEF3F8]" aria-label="Memuat sesi" />;
  if (session) return <TaxCoordinatorDashboard user={session} onLogout={logout} />;

  return <main className="dashboard-grid grid min-h-screen place-items-center bg-[#EEF3F8] p-4">
    <section className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl shadow-slate-300/50 sm:p-9">
      <div className="mb-8 flex items-center gap-4">
        <div><h1 className="text-2xl font-black tracking-tight text-slate-950">DASHBOARD</h1><p className="text-sm font-semibold text-slate-500">Finance, Tax &amp; Legal</p></div>
      </div>
      <div className="mb-6"><h2 className="text-xl font-black text-slate-950">LOGIN</h2><p className="mt-2 text-sm leading-6 text-slate-600">Gunakan user yang telah didaftarkan oleh administrator.</p></div>
      <form onSubmit={login} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">User Id</label>
          <Input
            id="email"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={userId}
            onChange={(event) => { setUserId(normalizeEmail(event.target.value)); setError(""); }}
            placeholder="user"
            className="h-12 rounded-2xl bg-white"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">Password</label>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="password" className="h-12 rounded-2xl bg-white pr-12" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <Button type="submit" disabled={loggingIn} className="h-12 w-full rounded-2xl bg-blue-600 text-base font-bold hover:bg-blue-700 disabled:opacity-60"><LogIn className="h-5 w-5" /> {loggingIn ? "Memproses..." : "Masuk"}</Button>
      </form>
    </section>
  </main>;
}
