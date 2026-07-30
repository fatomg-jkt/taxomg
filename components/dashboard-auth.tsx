"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, Receipt } from "lucide-react";
import { TaxCoordinatorDashboard } from "@/components/tax-coordinator-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_STORAGE_KEY, getUserByEmail, normalizeEmail, validateLogin, type UserRole } from "@/lib/user-access";

type UserSession = { name: string; email: string; role: UserRole; loginTime: string };

function readSession(): UserSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<UserSession>;
    if (typeof parsed.email !== "string" || typeof parsed.loginTime !== "string") return null;
    const user = getUserByEmail(parsed.email);
    return user ? { name: user.name, email: normalizeEmail(user.email), role: user.role, loginTime: parsed.loginTime } : null;
  } catch {
    return null;
  }
}

export function DashboardAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }
    if (!password) {
      setError("Password wajib diisi.");
      return;
    }
    const registeredUser = getUserByEmail(email);
    if (!registeredUser) {
      setError("Email tidak memiliki akses.");
      return;
    }
    const user = validateLogin(email, password);
    if (!user) {
      setError("Password salah.");
      return;
    }

    const nextSession: UserSession = { name: user.name, email: normalizeEmail(user.email), role: user.role, loginTime: new Date().toISOString() };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    setError("");
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    setEmail("");
    setPassword("");
    setSession(null);
  }

  if (!ready) return <main className="min-h-screen bg-[#EEF3F8]" aria-label="Memuat sesi" />;

  if (session) return <TaxCoordinatorDashboard user={session} onLogout={logout} />;

  return <main className="dashboard-grid grid min-h-screen place-items-center bg-[#EEF3F8] p-4">
    <section className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-2xl shadow-slate-300/50 sm:p-9">
      <div className="mb-8 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"><Receipt className="h-7 w-7" /></div>
        <div><h1 className="text-2xl font-black tracking-tight text-slate-950">DASHBOARD</h1><p className="text-sm font-semibold text-slate-500">Finance & Tax</p></div>
      </div>
      <div className="mb-6"><h2 className="text-xl font-black text-slate-950">LOGIN</h2><p className="mt-2 text-sm leading-6 text-slate-600">Gunakan email yang telah didaftarkan oleh administrator.</p></div>
      <form onSubmit={login} className="space-y-5">
        <div><label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">User Id</label><Input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="email" className="h-12 rounded-2xl bg-white" /></div>
        <div><label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">Password</label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="password" className="h-12 rounded-2xl bg-white pr-12" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <Button type="submit" className="h-12 w-full rounded-2xl bg-blue-600 text-base font-bold hover:bg-blue-700"><LogIn className="h-5 w-5" /> Masuk</Button>
      </form>
    </section>
  </main>;
}
