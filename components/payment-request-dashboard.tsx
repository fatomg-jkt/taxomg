"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type PaymentRequest = {
  id: string;
  userName: string;
  department: string;
  code: string;
  invoiceDate: string;
  description: string;
  invoiceNumber: string;
  vendor: string;
  nominal: number;
  accountName: string;
  bank: string;
  accountNumber: string;
  createdAt: string;
};

type FormState = Omit<PaymentRequest, "id" | "createdAt" | "nominal"> & { nominal: string };

const EMPTY_FORM: FormState = {
  userName: "",
  department: "",
  code: "",
  invoiceDate: "",
  description: "",
  invoiceNumber: "",
  vendor: "",
  nominal: "",
  accountName: "",
  bank: "",
  accountNumber: "",
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function sessionUserName() {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("authSession");
    if (!raw) return "";
    const session = JSON.parse(raw);
    return String(session?.name || session?.email || "");
  } catch {
    return "";
  }
}

export function PaymentRequestDashboard() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/payment-request-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Gagal memuat pengajuan pembayaran.");
        setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat pengajuan pembayaran."))
      .finally(() => setLoading(false));
  }, []);

  const totalNominal = useMemo(() => requests.reduce((sum, item) => sum + Number(item.nominal || 0), 0), [requests]);

  function openForm() {
    setForm({ ...EMPTY_FORM, userName: sessionUserName() });
    setError("");
    setMessage("");
    setOpen(true);
  }

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nominal = Number(form.nominal.replace(/[^\d-]/g, ""));
    const required = [form.userName, form.department, form.code, form.invoiceDate, form.description, form.invoiceNumber, form.vendor, form.accountName, form.bank, form.accountNumber];
    if (required.some((value) => !value.trim()) || !Number.isFinite(nominal) || nominal <= 0) {
      setError("Semua field wajib diisi dengan benar.");
      return;
    }

    const password = window.prompt("Masukkan password edit dashboard untuk menyimpan pengajuan pembayaran.");
    if (!password) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/payment-request-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dashboard-password": password },
        body: JSON.stringify({ request: { ...form, nominal } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan pengajuan pembayaran.");
      setRequests(Array.isArray(payload.requests) ? payload.requests : [payload.request, ...requests]);
      setMessage("Pengajuan pembayaran berhasil ditambahkan.");
      setOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengajuan pembayaran.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Pengajuan Pembayaran</h1>
        <p className="mt-2 text-base font-medium text-slate-600">Input dan daftar pengajuan pembayaran.</p>
      </div>
      <Button onClick={openForm} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> Tambah Pengajuan</Button>
    </div>

    {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Daftar Pengajuan Pembayaran</CardTitle>
        <CardDescription>{requests.length} pengajuan · Total {rupiah(totalNominal)}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[1500px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <tr>{["Nama User", "Departemen", "Kode", "Tanggal Inv", "Keterangan", "No. Inv", "Vendor", "Nominal", "Nama Rekening", "Bank", "Nomor Rekening"].map((label) => <th key={label} className="border-b border-slate-200 px-4 py-3">{label}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="px-4 py-12 text-center font-semibold text-slate-500">Memuat data...</td></tr> : requests.length ? requests.map((item) => <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
              <td className="px-4 py-3 font-semibold">{item.userName}</td>
              <td className="px-4 py-3">{item.department}</td>
              <td className="px-4 py-3 font-semibold">{item.code}</td>
              <td className="px-4 py-3 whitespace-nowrap">{item.invoiceDate}</td>
              <td className="max-w-xs whitespace-normal break-words px-4 py-3">{item.description}</td>
              <td className="px-4 py-3">{item.invoiceNumber}</td>
              <td className="px-4 py-3">{item.vendor}</td>
              <td className="px-4 py-3 whitespace-nowrap font-bold">{rupiah(Number(item.nominal || 0))}</td>
              <td className="px-4 py-3">{item.accountName}</td>
              <td className="px-4 py-3">{item.bank}</td>
              <td className="px-4 py-3">{item.accountNumber}</td>
            </tr>) : <tr><td colSpan={11} className="px-4 py-12 text-center font-semibold text-slate-500">Belum ada pengajuan pembayaran.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>

    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="text-2xl font-black text-slate-950">Tambah Pengajuan Pembayaran</h2><p className="mt-1 text-sm font-medium text-slate-500">Isi seluruh data pengajuan berikut.</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Nama user yang isi" value={form.userName} onChange={(value) => update("userName", value)} />
          <Field label="Departemen" value={form.department} onChange={(value) => update("department", value)} />
          <Field label="Kode" value={form.code} onChange={(value) => update("code", value)} />
          <Field label="Tanggal Inv" type="date" value={form.invoiceDate} onChange={(value) => update("invoiceDate", value)} />
          <label className="space-y-2 md:col-span-2"><span className="text-sm font-bold text-slate-700">Keterangan</span><textarea required rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></label>
          <Field label="No. Inv" value={form.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} />
          <Field label="Vendor" value={form.vendor} onChange={(value) => update("vendor", value)} />
          <Field label="Nominal" inputMode="numeric" value={form.nominal} onChange={(value) => update("nominal", value)} placeholder="0" />
          <Field label="Nama Rekening" value={form.accountName} onChange={(value) => update("accountName", value)} />
          <Field label="Bank" value={form.bank} onChange={(value) => update("bank", value)} />
          <Field label="Nomer Rekening" inputMode="numeric" value={form.accountNumber} onChange={(value) => update("accountNumber", value)} />
          {error && <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>Batal</Button>
          <Button type="submit" disabled={saving} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700">{saving ? "Menyimpan..." : "Insert Pengajuan"}</Button>
        </div>
      </form>
    </div>}
  </div>;
}

function Field({ label, value, onChange, type = "text", inputMode, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "numeric" | "text" | "decimal"; placeholder?: string }) {
  return <label className="space-y-2"><span className="text-sm font-bold text-slate-700">{label}</span><Input required type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl" /></label>;
}
