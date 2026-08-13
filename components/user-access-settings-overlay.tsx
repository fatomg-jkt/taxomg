"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AUTH_STORAGE_KEY, USER_DIRECTORY_STORAGE_KEY, type UserDirectoryEntry, type UserRole } from "@/lib/user-access";

type Session = { name: string; email: string; role: UserRole; loginTime: string };
type DraftUser = UserDirectoryEntry & { id: string; password: string };
const ROLES: UserRole[] = ["OWNER", "SUPER_ADMIN", "TAX_USER", "FINANCE_USER"];

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}

function cacheUsers(users: UserDirectoryEntry[]) {
  localStorage.setItem(USER_DIRECTORY_STORAGE_KEY, JSON.stringify(users));
}

export function UserAccessSettingsOverlay() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<DraftUser[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actorPassword, setActorPassword] = useState("");
  const [showActorPassword, setShowActorPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sidebarFooter, setSidebarFooter] = useState<HTMLElement | null>(null);

  const loadDirectory = useCallback(async () => {
    try {
      const response = await fetch("/api/user-access", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ users: [] }));
      if (response.ok && Array.isArray(payload.users)) {
        cacheUsers(payload.users);
        setUsers(payload.users.map((user: UserDirectoryEntry) => ({ ...user, id: String(user.id || crypto.randomUUID()), password: "" })));
      }
    } catch {
      // Login tetap dapat memakai akun default bila cloud sementara tidak tersedia.
    }
  }, []);

  useEffect(() => {
    loadDirectory().finally(() => setSession(readSession()));
    const sync = () => setSession(readSession());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [loadDirectory]);

  useEffect(() => {
    if (!session) {
      setSidebarFooter(null);
      return;
    }

    let frame = 0;
    const arrangeSidebarFooter = () => {
      const logoutButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Logout");
      const footer = logoutButton?.parentElement as HTMLElement | null;
      if (!footer || !logoutButton) {
        frame = window.requestAnimationFrame(arrangeSidebarFooter);
        return;
      }

      footer.style.display = "flex";
      footer.style.flexDirection = "column";
      footer.style.alignItems = "stretch";

      const paragraphs = Array.from(footer.querySelectorAll<HTMLElement>(":scope > p"));
      logoutButton.style.order = "2";
      logoutButton.style.marginTop = "0.25rem";
      if (paragraphs[0]) {
        paragraphs[0].style.order = "3";
        paragraphs[0].style.marginTop = "0.75rem";
      }
      if (paragraphs[1]) {
        paragraphs[1].style.order = "4";
      }
      setSidebarFooter(footer);
    };

    frame = window.requestAnimationFrame(arrangeSidebarFooter);
    return () => window.cancelAnimationFrame(frame);
  }, [session]);

  useEffect(() => {
    const interceptLogin = async (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;
      const emailInput = form.querySelector<HTMLInputElement>("#email");
      const passwordInput = form.querySelector<HTMLInputElement>("#password");
      if (!emailInput || !passwordInput) return;

      event.preventDefault();
      event.stopPropagation();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) return;

      const oldError = form.querySelector("[data-user-login-error]");
      oldError?.remove();
      try {
        const response = await fetch("/api/user-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.error || "User ID atau password salah.");
        const nextSession: Session = { ...payload.user, loginTime: new Date().toISOString() };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        await loadDirectory();
        window.location.reload();
      } catch (loginError) {
        const node = document.createElement("p");
        node.dataset.userLoginError = "true";
        node.className = "rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700";
        node.textContent = loginError instanceof Error ? loginError.message : "Login gagal.";
        const button = form.querySelector("button[type='submit']");
        button?.parentElement?.insertBefore(node, button);
      }
    };

    document.addEventListener("submit", interceptLogin, true);
    return () => document.removeEventListener("submit", interceptLogin, true);
  }, [loadDirectory]);

  const canManage = session?.role === "OWNER" || session?.role === "SUPER_ADMIN";
  const ownerCount = useMemo(() => users.filter((user) => user.role === "OWNER").length, [users]);

  function updateUser(id: string, patch: Partial<DraftUser>) {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user));
    setMessage(""); setError("");
  }

  function addUser() {
    setUsers((current) => [...current, { id: crypto.randomUUID(), name: "User Baru", email: "", role: "TAX_USER", password: "" }]);
  }

  function removeUser(id: string) {
    const target = users.find((user) => user.id === id);
    if (target?.role === "OWNER" && ownerCount <= 1) { setError("Minimal harus ada satu OWNER."); return; }
    setUsers((current) => current.filter((user) => user.id !== id));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session || !canManage) return;
    if (!actorPassword) { setError("Masukkan password akun Anda untuk menyimpan perubahan."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/user-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", actorEmail: session.email, actorPassword, users }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan pengaturan user.");
      cacheUsers(payload.users || []);
      setUsers((payload.users || []).map((user: UserDirectoryEntry) => ({ ...user, id: String(user.id || crypto.randomUUID()), password: "" })));
      setActorPassword("");
      setMessage("Pengaturan user berhasil disimpan. Password kosong berarti password lama dipertahankan.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan pengaturan user.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;

  const settingsButton = <button
    onClick={() => { setOpen(true); loadDirectory(); }}
    className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
    style={{ order: 1 }}
    title="Atur User ID, password, dan role"
  >
    <Settings className="h-5 w-5 shrink-0" /><span>Setting</span>
  </button>;

  return <>
    {sidebarFooter ? createPortal(settingsButton, sidebarFooter) : null}

    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
      <form onSubmit={save} className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="text-2xl font-black text-slate-950">Pengaturan User</h2><p className="mt-1 text-sm font-medium text-slate-500">Atur User ID, password, dan role akses dashboard.</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {users.map((user) => <div key={user.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.4fr_1fr_1.1fr_auto] md:items-end">
            <label className="space-y-1"><span className="text-xs font-extrabold uppercase text-slate-500">Nama</span><Input value={user.name} onChange={(e) => updateUser(user.id, { name: e.target.value })} className="rounded-xl bg-white" /></label>
            <label className="space-y-1"><span className="text-xs font-extrabold uppercase text-slate-500">User ID</span><Input type="email" value={user.email} onChange={(e) => updateUser(user.id, { email: e.target.value })} className="rounded-xl bg-white" /></label>
            <label className="space-y-1"><span className="text-xs font-extrabold uppercase text-slate-500">Role</span><Select value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value as UserRole })} className="h-10 rounded-xl bg-white">{ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</Select></label>
            <label className="space-y-1"><span className="text-xs font-extrabold uppercase text-slate-500">Password</span><Input type="password" value={user.password} onChange={(e) => updateUser(user.id, { password: e.target.value })} placeholder="Kosong = tetap" className="rounded-xl bg-white" /></label>
            <Button type="button" variant="outline" size="icon" className="rounded-xl text-red-600" onClick={() => removeUser(user.id)} title="Hapus user"><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          <Button type="button" variant="outline" onClick={addUser} className="rounded-2xl font-bold"><Plus className="h-4 w-4" /> Tambah User</Button>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-blue-950">Konfirmasi administrator</p>
            <p className="mt-1 text-xs font-medium text-blue-700">Masukkan password akun {session.email} sebelum menyimpan perubahan.</p>
            <div className="relative mt-3 max-w-md"><Input type={showActorPassword ? "text" : "password"} value={actorPassword} onChange={(e) => setActorPassword(e.target.value)} placeholder="Password Anda" className="rounded-xl bg-white pr-12" /><button type="button" onClick={() => setShowActorPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500">{showActorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>Tutup</Button>
          <Button type="submit" disabled={busy} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Save className="h-4 w-4" /> {busy ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </div>
      </form>
    </div>}
  </>;
}
