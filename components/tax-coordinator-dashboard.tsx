"use client";

import { useRef, useState } from "react";
import { BarChart3, Building2, Download, FileArchive, FileSpreadsheet, FileText, Menu, ReceiptText, Store, Upload, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "PPN", icon: ReceiptText },
  { label: "PPh Pasal 21", icon: FileText },
  { label: "PPh Unifikasi", icon: FileArchive },
  { label: "PB1", icon: Store },
  { label: "UMKM", icon: Building2 },
  { label: "Dokumen Pajak", icon: FileSpreadsheet },
];

const summaryCards = [
  { label: "PPN Keluaran", value: "Rp 103 jt", accent: "bg-blue-500" },
  { label: "PPN Masukan", value: "Rp 32 jt", accent: "bg-emerald-500" },
  { label: "KB/(LB)", value: "Rp 71 jt", accent: "bg-orange-500" },
  { label: "PM Tidak Dikreditkan", value: "Rp 215.814", accent: "bg-red-500" },
  { label: "Masa PPN", value: "4", accent: "bg-indigo-500" },
];

const statusRows = [
  ["PPN Keluaran", "Multi masa", "15 Februari 2026", "Terverifikasi", "Rp 103.208.711"],
  ["PPN KB/LB", "Multi masa", "15 Februari 2026", "Terverifikasi", "Rp 83.681.600"],
  ["PPN Masukan", "Multi masa", "15 Februari 2026", "Terverifikasi", "Rp 19.527.111"],
  ["PPN Masukan Tidak Dikreditkan", "Multi masa", "15 Februari 2026", "Terverifikasi", "Rp 215.814"],
];

const vatRows = [
  ["CV 1001", "Jan-26", "Rp 46.140.487", "Rp 5.145.628", "Rp 40.994.859", "18E965BMSRJ4L749"],
  ["CV 1001", "Feb-26", "Rp 32.856.012", "Rp 691.878", "Rp 32.164.134", "9A976684GAFNKVEQ"],
  ["CV 1001", "Mar-26", "Rp 24.212.212", "Rp 13.905.419", "Rp 10.306.793", "001403ISSLB147J8"],
  ["CV 1001", "Apr-26", "Rp 0", "Rp 12.584.131", "Rp -12.584.131", "-"],
];

const chartData = [
  { name: "PPN Keluaran", value: 103_208_711, color: "#2563eb" },
  { name: "PPN KB/LB", value: 83_681_600, color: "#f97316" },
  { name: "PPN Masukan", value: 19_527_111, color: "#22c55e" },
  { name: "PPN Masukan Tidak Dikreditkan", value: 215_814, color: "#ef4444" },
];

function downloadCsv() {
  const headers = ["Perusahaan", "Masa", "PPN Keluaran", "PPN Masukan", "KB/LB", "NTPN"];
  const csv = [headers, ...vatRows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "perhitungan-ppn.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TaxCoordinatorDashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const Sidebar = (
    <aside className="flex h-full flex-col bg-slate-950 px-4 py-6 text-white shadow-2xl">
      <div className="mb-8 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <ReceiptText className="h-6 w-6" />
        </div>
        <div>
          <p className="font-black leading-tight">Tax Coordinator</p>
          <p className="text-xs text-slate-400">Dashboard</p>
        </div>
      </div>
      <nav className="space-y-1.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white",
              item.label === "PPN" && "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
            )}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="font-bold text-white">Modern tax control</p>
        <p className="mt-1 text-xs leading-5">Monitoring PPN multi masa dan multi perusahaan secara ringkas.</p>
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">{Sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 grid grid-cols-[280px_1fr] bg-slate-950/50 lg:hidden">
          {Sidebar}
          <button aria-label="Tutup sidebar" onClick={() => setMobileOpen(false)} className="p-4 text-white"><X /></button>
        </div>
      )}

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" className="bg-white lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tax Coordinator Dashboard</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">Pajak masukan dan pajak keluaran - Semua masa / Semua perusahaan</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_190px_auto_auto]">
            <Select aria-label="Semua Masa" defaultValue="Semua Masa" className="bg-white"><option>Semua Masa</option><option>Jan-26</option><option>Feb-26</option><option>Mar-26</option><option>Apr-26</option></Select>
            <Select aria-label="Semua Perusahaan" defaultValue="Semua Perusahaan" className="bg-white"><option>Semua Perusahaan</option><option>CV 1001</option></Select>
            <Input ref={inputRef} type="file" accept=".xls,.xlsx,.csv" className="hidden" />
            <Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" />Upload Excel</Button>
            <Button variant="outline" className="bg-white" onClick={downloadCsv}><Download className="h-4 w-4" />Export CSV</Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <Card key={card.label} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className={cn("mb-5 h-1.5 w-12 rounded-full", card.accent)} />
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle>PPN &amp; Status</CardTitle><CardDescription>Ringkasan kewajiban, jatuh tempo, dan status verifikasi.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>{["Jenis Pajak", "Periode", "Due Date", "Status", "Jumlah"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{statusRows.map((row) => <TableRow key={row[0]}>{row.map((cell, index) => <TableCell key={cell} className={index === 0 || index === 4 ? "font-semibold" : undefined}>{index === 3 ? <Badge variant="success">{cell}</Badge> : cell}</TableCell>)}</TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle>Komposisi PPN</CardTitle><CardDescription>Total Rp 207 jt</CardDescription></CardHeader>
            <CardContent>
              <div className="relative h-64">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={68} outerRadius={98} paddingAngle={3}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="text-center"><p className="text-xs font-semibold text-slate-500">Total</p><p className="text-2xl font-black">Rp 207 jt</p></div></div>
              </div>
              <div className="mt-2 space-y-3">{chartData.map((item) => <div key={item.name} className="flex items-center gap-2 text-sm font-medium text-slate-600"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</div>)}</div>
            </CardContent>
          </Card>
        </section>

        <Card className="mt-6 border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle>Perhitungan PPN</CardTitle><CardDescription>Detail perhitungan PPN per masa pajak dengan nomor NTPN.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>{["Perusahaan", "Masa", "PPN Keluaran", "PPN Masukan", "KB/LB", "NTPN"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{vatRows.map((row) => <TableRow key={row[1]}>{row.map((cell, index) => <TableCell key={`${row[1]}-${index}`} className={cn(index === 0 && "font-semibold", index === 4 && (cell.includes("-") ? "font-semibold text-red-600" : "font-semibold text-orange-600"))}>{cell}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
