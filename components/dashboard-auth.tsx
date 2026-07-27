"use client";

import { FormEvent, useEffect, useState } from "react";
import { LogIn, Receipt } from "lucide-react";
import { TaxCoordinatorDashboard } from "@/components/tax-coordinator-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_STORAGE_KEY, getRoleForEmail, normalizeEmail, type UserRole } from "@/lib/user-access";

type UserSession = { email: string; role: UserRole };

function readSession(): UserSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<UserSession>;
    if (typeof parsed.email !== "string") return null;
    const role = getRoleForEmail(parsed.email);
    return role ? { email: normalizeEmail(parsed.email), role } : null;
  } catch {
    return null;
  }
}

export function DashboardAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedSession = readSession();
    if (!storedSession) localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(storedSession);
    setReady(true);
  }, []);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = getRoleForEmail(email);
    if (!role) {
      setError("Email tidak memiliki akses ke dashboard ini.");
      return;
    }

    const nextSession = { email: normalizeEmail(email), role };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    setError("");
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    setEmail("");
    setSession(null);
  }

  if (!ready) return <main className="min-h-screen bg-[#EEF3F8]" aria-label="Memuat sesi" />;

  if (session) return <TaxCoordinatorDashboard user={session} onLogout={logout} />;

  return <main className="dashboard-grid grid min-h-screen place-items-center bg-[#EEF3F8] p-4">
    <section className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl shadow-slate-300/50 sm:p-9">
      <div className="mb-8 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"><Receipt className="h-7 w-7" /></div>
        <div><h1 className="text-2xl font-black tracking-tight text-slate-950">Tax Coordinator</h1><p className="text-sm font-semibold text-slate-500">Tax & Finance Dashboard</p></div>
      </div>
      <div className="mb-6"><h2 className="text-xl font-black text-slate-950">Masuk ke dashboard</h2><p className="mt-2 text-sm leading-6 text-slate-600">Gunakan email yang telah didaftarkan oleh administrator.</p></div>
      <form onSubmit={login} className="space-y-5">
        <div><label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">Email</label><Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="nama@company.com" className="h-12 rounded-2xl bg-white" /></div>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <Button type="submit" className="h-12 w-full rounded-2xl bg-blue-600 text-base font-bold hover:bg-blue-700"><LogIn className="h-5 w-5" /> Masuk</Button>
      </form>
    </section>
  </main>;
}
