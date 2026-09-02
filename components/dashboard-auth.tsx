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

  if (!ready) return <main className="min-h-screen bg-masterplan-bone" aria-label="Memuat sesi" />;
  if (session) return <TaxCoordinatorDashboard user={session} onLogout={logout} />;

  return (
    <main className="grid min-h-screen bg-masterplan-bone text-masterplan-ink lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="hidden min-h-screen bg-masterplan-ink p-16 text-masterplan-bone lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-masterplan-pale/70">Internal Management System</p>
          <div className="mt-8 h-px w-full bg-masterplan-bone/20" />
        </div>
        <div className="max-w-xl">
          <h1 className="text-6xl font-bold leading-[0.96] tracking-[-0.04em] text-masterplan-bone">Dashboard<br />Finance, Tax &amp; Legal</h1>
          <p className="mt-8 text-xl font-medium text-masterplan-pale">Kantor Kencana</p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-masterplan-pale/60">Secure access · 2026</p>
      </section>

      <section className="flex min-h-screen items-center bg-masterplan-bone px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="border-b border-masterplan-ink/15 pb-8 lg:hidden">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-masterplan-plum">Internal Management System</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em]">Selamat Datang di Dashboard Finance, Tax dan Legal</h1>
            <p className="mt-2 text-sm text-masterplan-ink/60">Kantor Kencana</p>
          </div>

          <div className="mt-10 border-t border-masterplan-ink pt-6 lg:mt-0">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-masterplan-plum">Access / Login</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.03em]">Selamat Datang di Dashboard Finance, Tax dan Legal</h2>
            <p className="mt-3 text-sm leading-6 text-masterplan-ink/60">Kantor Kencana · gunakan user yang telah didaftarkan oleh administrator.</p>
          </div>

          <form onSubmit={login} noValidate className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-masterplan-plum">User Id</label>
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
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-masterplan-plum">Password</label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="password" className="pr-12" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-xl text-masterplan-ink/50 hover:bg-masterplan-ink/5 hover:text-masterplan-ink">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            {error && <p role="alert" className="border-l-4 border-masterplan-magenta py-2 pl-4 text-sm font-semibold text-masterplan-ink">{error}</p>}
            <Button type="submit" disabled={loggingIn} className="w-full sm:w-auto"><LogIn className="h-5 w-5" /> {loggingIn ? "Memproses..." : "Masuk"}</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
