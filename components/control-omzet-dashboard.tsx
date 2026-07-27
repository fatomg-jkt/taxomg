"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Cloud, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  CONTROL_OMZET_GROUPS,
  CONTROL_OMZET_MONTHS,
  controlOmzetStatus,
  parseControlOmzetWorkbook,
  type ControlOmzetRow,
  type ControlOmzetStatus,
} from "@/lib/control-omzet";

const ALL = "__all__";
const STATUSES: ControlOmzetStatus[] = ["Aman", "Perlu Review", "Tidak Terlapor", "Lebih Terlapor", "Tidak Ada Data"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROUP_COLORS: Record<string, { group: string; entity: string; sub: string }> = {
  "1001": { group: "bg-emerald-700 text-white", entity: "bg-emerald-100 text-emerald-950", sub: "bg-emerald-50 text-emerald-900" },
  Obsidian: { group: "bg-slate-800 text-white", entity: "bg-slate-200 text-slate-950", sub: "bg-slate-100 text-slate-800" },
  Resto: { group: "bg-rose-800 text-white", entity: "bg-rose-200 text-rose-950", sub: "bg-rose-100 text-rose-900" },
  Management: { group: "bg-purple-800 text-white", entity: "bg-purple-200 text-purple-950", sub: "bg-purple-100 text-purple-900" },
};

type Filters = { tahun: string; masa: string; group: string; entity: string; status: string };
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const number = (value: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(safeNumber(value));

export function ControlOmzetDashboard({ data, setData, saving, onSave }: { data: ControlOmzetRow[]; setData: (rows: ControlOmzetRow[]) => void; saving: boolean; onSave: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState<Filters>({ tahun: ALL, masa: ALL, group: ALL, entity: ALL, status: ALL });
  const years = useMemo(() => Array.from(new Set(data.map((row) => safeNumber(row.tahun)).filter(Boolean))).sort(), [data]);
  const selectedYear = filters.tahun === ALL ? (years.at(-1) ?? 2026) : Number(filters.tahun);
  const availableEntities = useMemo(() => CONTROL_OMZET_GROUPS.flatMap((group) => group.entities.map((entity) => ({ group: group.name, entity }))), []);
  const visibleGroups = useMemo(() => CONTROL_OMZET_GROUPS.map((group) => ({ ...group, entities: group.entities.filter((entity) => (filters.group === ALL || group.name === filters.group) && (filters.entity === ALL || entity === filters.entity)) })).filter((group) => group.entities.length), [filters.group, filters.entity]);
  const visibleMonths = CONTROL_OMZET_MONTHS.filter((month) => filters.masa === ALL || month === filters.masa);
  const filtered = useMemo(() => data.filter((row) => safeNumber(row.tahun) === selectedYear && (filters.group === ALL || row.group === filters.group) && (filters.entity === ALL || row.entity === filters.entity) && (filters.status === ALL || controlOmzetStatus(row) === filters.status)), [data, filters.entity, filters.group, filters.status, selectedYear]);
  const cellValue = (masa: string, group: string, entity: string, key: "omzet" | "terlapor") => filtered.filter((row) => row.masa === masa && row.group === group && row.entity === entity).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const totalValue = (group: string, entity: string, key: "omzet" | "terlapor") => visibleMonths.reduce((sum, masa) => sum + cellValue(masa, group, entity, key), 0);
  // The normalized data currently has no annual-target field, so its documented safe fallback is zero.
  const remainingValue = (group: string, entity: string, key: "omzet" | "terlapor") => 0 - totalValue(group, entity, key);
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value, ...(key === "group" ? { entity: ALL } : {}) }));

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setMessage("");
    if (!/\.xlsx?$/i.test(file.name)) { setError("Format Excel Control Omzet tidak sesuai."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseControlOmzetWorkbook(reader.result as ArrayBuffer);
        setData(parsed);
        setMessage(parsed.length ? `${parsed.length} baris Control Omzet berhasil dimuat. Data lama telah diganti.` : "Excel kosong. Struktur tabel tetap siap digunakan.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Format Excel Control Omzet tidak sesuai."); }
      finally { event.target.value = ""; }
    };
    reader.onerror = () => { setError("File Excel tidak dapat dibaca."); event.target.value = ""; };
    reader.readAsArrayBuffer(file);
  }

  return <div className="space-y-5">
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        {([
          ["tahun", "Semua Tahun", years.length ? years.map(String) : ["2026"]],
          ["masa", "Semua Masa Pajak", [...CONTROL_OMZET_MONTHS]],
          ["group", "Semua Group", CONTROL_OMZET_GROUPS.map((group) => group.name)],
          ["entity", "Semua Entity", availableEntities.filter((item) => filters.group === ALL || item.group === filters.group).map((item) => item.entity)],
          ["status", "Semua Status", STATUSES],
        ] as [keyof Filters, string, readonly string[]][]).map(([key, label, options]) => <Select key={key} value={filters[key]} onChange={(event) => update(key, event.target.value)} className="h-11 min-w-40 flex-1 rounded-xl border-slate-200 bg-white"><option value={ALL}>{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>)}
        <Button onClick={() => input.current?.click()} className="h-11 rounded-xl bg-blue-600 px-5 font-bold hover:bg-blue-700"><Upload className="h-4 w-4" /> Upload Excel</Button>
        <Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-xl px-5 font-bold"><Cloud className="h-4 w-4" />{saving ? "Menyimpan..." : "Save to Cloud"}</Button>
        <input ref={input} type="file" accept=".xlsx,.xls" onChange={upload} hidden />
      </CardContent>
    </Card>
    {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-white pb-4">
        <CardTitle className="text-xl text-slate-900">YTD Control Omzet {selectedYear}</CardTitle>
        <CardDescription>Perbandingan omzet dan nilai terlapor per masa pajak. Geser tabel untuk melihat seluruh entity.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs text-slate-700">
            <thead className="sticky top-0 z-20">
              <tr>
                <th rowSpan={3} className="sticky left-0 z-40 min-w-24 border-b border-r border-slate-300 bg-slate-900 px-4 py-3 text-left text-sm font-extrabold text-white shadow-[2px_0_0_#cbd5e1]">Masa</th>
                {visibleGroups.map((group) => <th key={group.name} colSpan={group.entities.length * 2} className={`border-b border-r border-white/30 px-3 py-3 text-center text-sm font-extrabold tracking-wide ${GROUP_COLORS[group.name].group}`}>{group.name}</th>)}
              </tr>
              <tr>{visibleGroups.flatMap((group) => group.entities.map((entity) => <th key={`${group.name}-${entity}`} colSpan={2} className={`min-w-52 border-b border-r border-slate-300 px-3 py-3 text-center font-bold ${GROUP_COLORS[group.name].entity}`}>{entity}</th>))}</tr>
              <tr>{visibleGroups.flatMap((group) => group.entities.flatMap((entity) => ([<th key={`${entity}-omzet`} className={`min-w-32 border-b border-r border-slate-300 px-3 py-2 text-right font-bold ${GROUP_COLORS[group.name].sub}`}>Omset</th>, <th key={`${entity}-terlapor`} className={`min-w-32 border-b border-r border-slate-300 px-3 py-2 text-right font-bold ${GROUP_COLORS[group.name].sub}`}>Terlapor</th>])))}</tr>
            </thead>
            <tbody>
              {visibleMonths.map((masa, index) => <tr key={masa} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-inherit px-4 py-3 text-left font-bold text-slate-800 shadow-[2px_0_0_#e2e8f0]">{MONTH_LABELS[CONTROL_OMZET_MONTHS.indexOf(masa)]} {String(selectedYear).slice(-2)}</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => (["omzet", "terlapor"] as const).map((key) => <td key={`${masa}-${entity}-${key}`} className="border-b border-r border-slate-200 px-3 py-3 text-right tabular-nums">{number(cellValue(masa, group.name, entity, key))}</td>)))}
              </tr>)}
              <tr className="bg-slate-800 font-extrabold text-white">
                <th className="sticky left-0 z-10 border-r border-slate-600 bg-slate-900 px-4 py-3 text-left shadow-[2px_0_0_#475569]">Total</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => (["omzet", "terlapor"] as const).map((key) => <td key={`total-${entity}-${key}`} className="border-r border-slate-600 px-3 py-3 text-right tabular-nums">{number(totalValue(group.name, entity, key))}</td>)))}
              </tr>
              <tr className="bg-amber-50 font-semibold italic text-amber-950">
                <th className="sticky left-0 z-10 border-r border-t border-amber-200 bg-amber-100 px-4 py-3 text-left shadow-[2px_0_0_#fde68a]">Sisa</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => (["omzet", "terlapor"] as const).map((key) => <td key={`sisa-${entity}-${key}`} className="border-r border-t border-amber-200 px-3 py-3 text-right tabular-nums">{number(remainingValue(group.name, entity, key))}</td>)))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>;
}
