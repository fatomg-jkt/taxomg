"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
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
        <img src="data:image/jpeg;base64,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" alt="OMG - Obsidian Management Group" className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-slate-900/20" />
        <div><h1 className="text-2xl font-black tracking-tight text-slate-950">DASHBOARD</h1><p className="text-sm font-semibold text-slate-500">Finance, Tax &amp; Legal</p></div>
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
