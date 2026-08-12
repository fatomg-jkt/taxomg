"use client";

import { useMemo, useState } from "react";
import { Cloud, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  CONTROL_OMZET_GROUPS,
  CONTROL_OMZET_MONTHS,
  type ControlOmzetRow,
} from "@/lib/control-omzet";

const ALL = "__all__";
const ANNUAL_OMZET_LIMIT = 4_800_000_000;
const OBSIDIAN_GROUP = "Obsidian";
const PGO_ENTITY = "PT Prima Global Obsidian";
const STB_ENTITY = "PT Sejuta Toko Bersama";
const OBSIDIAN_UNREPORTED_ENTITY = "Omset Tidak Terlapor PGO + STB";
const EMPTY_REMAINING_ENTITIES = new Set(["CV Sepuluh Januari Sukses", PGO_ENTITY, "PT Makan Setiap Hari"]);
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROUP_COLORS: Record<string, { group: string; entity: string; sub: string }> = {
  "1001": { group: "bg-emerald-700 text-white", entity: "bg-emerald-100 text-emerald-950", sub: "bg-emerald-50 text-emerald-900" },
  Obsidian: { group: "bg-slate-800 text-white", entity: "bg-slate-200 text-slate-950", sub: "bg-slate-100 text-slate-800" },
  Resto: { group: "bg-rose-800 text-white", entity: "bg-rose-200 text-rose-950", sub: "bg-rose-100 text-rose-900" },
  Management: { group: "bg-purple-800 text-white", entity: "bg-purple-200 text-purple-950", sub: "bg-purple-100 text-purple-900" },
};

type Filters = { tahun: string; masa: string; group: string; entity: string };
type OmzetForm = { tahun: string; masa: string; group: string; entity: string; omzet: string; terlapor: string; keterangan: string };
const EMPTY_FORM: OmzetForm = { tahun: "2026", masa: "", group: "", entity: "", omzet: "", terlapor: "", keterangan: "" };
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const number = (value: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(safeNumber(value));
const monthLabel = (masa: string, year = 2026) => `${MONTH_LABELS[CONTROL_OMZET_MONTHS.indexOf(masa as (typeof CONTROL_OMZET_MONTHS)[number])]} ${String(year).slice(-2)}`;
const samePeriod = (stored: string, masa: string, year: number) => stored === masa || stored === monthLabel(masa, year);

function parseInputNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^-?[\d.,\s]+$/.test(trimmed)) return null;
  const compact = trimmed.replace(/\s/g, "");
  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  const decimalAt = comma > dot ? comma : dot;
  const fraction = decimalAt >= 0 ? compact.slice(decimalAt + 1) : "";
  const normalized = decimalAt >= 0 && fraction.length > 0 && fraction.length <= 2
    ? `${compact.slice(0, decimalAt).replace(/[.,]/g, "")}.${fraction}`
    : compact.replace(/[.,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ControlOmzetDashboard({ data, setData, saving, onSave }: { data: ControlOmzetRow[]; setData: (rows: ControlOmzetRow[]) => void; saving: boolean; onSave: () => void }) {
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OmzetForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [filters, setFilters] = useState<Filters>({ tahun: ALL, masa: ALL, group: ALL, entity: ALL });
  const years = useMemo(() => Array.from(new Set(data.map((row) => safeNumber(row.tahun)).filter(Boolean))).sort(), [data]);
  const selectedYear = filters.tahun === ALL ? (years.at(-1) ?? 2026) : Number(filters.tahun);
  const availableEntities = useMemo(() => CONTROL_OMZET_GROUPS.flatMap((group) => group.entities.map((entity) => ({ group: group.name, entity }))), []);
  const visibleGroups = useMemo(() => CONTROL_OMZET_GROUPS.map((group) => ({ ...group, entities: group.entities.filter((entity) => (filters.group === ALL || group.name === filters.group) && (filters.entity === ALL || entity === filters.entity)) })).filter((group) => group.entities.length), [filters.group, filters.entity]);
  const visibleMonths = CONTROL_OMZET_MONTHS.filter((month) => filters.masa === ALL || month === filters.masa);
  const yearAndGroupRows = useMemo(() => data.filter((row) => safeNumber(row.tahun) === selectedYear && (filters.group === ALL || row.group === filters.group)), [data, filters.group, selectedYear]);
  const filtered = useMemo(() => yearAndGroupRows.filter((row) => filters.entity === ALL || row.entity === filters.entity), [filters.entity, yearAndGroupRows]);
  const cellValue = (masa: string, group: string, entity: string, key: "omzet" | "terlapor") => filtered.filter((row) => samePeriod(row.masa, masa, selectedYear) && row.group === group && row.entity === entity).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const totalValue = (group: string, entity: string, key: "omzet" | "terlapor") => visibleMonths.reduce((sum, masa) => sum + cellValue(masa, group, entity, key), 0);
  const obsidianEntityValue = (masa: string, entity: string, key: "omzet" | "terlapor") => yearAndGroupRows.filter((row) => samePeriod(row.masa, masa, selectedYear) && row.group === OBSIDIAN_GROUP && row.entity === entity).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const obsidianUnreportedValue = (masa: string) => obsidianEntityValue(masa, PGO_ENTITY, "omzet") + obsidianEntityValue(masa, STB_ENTITY, "omzet") - obsidianEntityValue(masa, PGO_ENTITY, "terlapor") - obsidianEntityValue(masa, STB_ENTITY, "terlapor");
  const obsidianUnreportedTotal = () => CONTROL_OMZET_MONTHS.reduce((sum, masa) => sum + obsidianUnreportedValue(masa), 0);
  const remainingValue = (group: string, entity: string, key: "omzet" | "terlapor") => ANNUAL_OMZET_LIMIT - totalValue(group, entity, key);
  const isObsidianUnreported = (group: string, entity: string) => group === OBSIDIAN_GROUP && entity === OBSIDIAN_UNREPORTED_ENTITY;
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value, ...(key === "group" ? { entity: ALL } : {}) }));

  function saveManualInput() {
    if (!form.tahun || !form.masa || !form.group || !form.entity) { setFormError("Tahun, Masa Pajak, Group, dan Entity wajib diisi."); return; }
    const omzet = parseInputNumber(form.omzet);
    const terlapor = parseInputNumber(form.terlapor);
    if (omzet === null || terlapor === null) { setFormError("Omset dan Terlapor harus berupa angka yang valid."); return; }
    const tahun = Number(form.tahun);
    const masa = CONTROL_OMZET_MONTHS[MONTH_LABELS.indexOf(form.masa.split(" ")[0])];
    if (!masa) { setFormError("Masa Pajak tidak valid."); return; }
    const nextRow: ControlOmzetRow = { tahun, masa: form.masa, group: form.group, entity: form.entity, omzet, terlapor, keterangan: form.keterangan, source: "Manual Input", selisih: omzet - terlapor, persentaseTerlapor: omzet === 0 ? 0 : terlapor / omzet * 100 };
    const existingIndex = data.findIndex((row) => row.tahun === tahun && samePeriod(row.masa, masa, tahun) && row.group === form.group && row.entity === form.entity);
    setData(existingIndex >= 0 ? data.map((row, index) => index === existingIndex ? { ...row, ...nextRow } : row) : [...data, nextRow]);
    setError(""); setFormError(""); setForm(EMPTY_FORM); setModalOpen(false);
  }

  return <div className="space-y-5">
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        {([
          ["masa", "Semua Masa Pajak", [...CONTROL_OMZET_MONTHS]],
          ["group", "Semua Group", CONTROL_OMZET_GROUPS.map((group) => group.name)],
          ["entity", "Semua Entity", availableEntities.filter((item) => filters.group === ALL || item.group === filters.group).map((item) => item.entity)],
        ] as [keyof Filters, string, readonly string[]][]).map(([key, label, options]) => <Select key={key} value={filters[key]} onChange={(event) => update(key, event.target.value)} className="h-11 min-w-40 flex-1 rounded-xl border-slate-200 bg-white"><option value={ALL}>{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>)}
        <Button onClick={onSave} disabled={saving} variant="outline" className="h-11 rounded-xl px-5 font-bold"><Cloud className="h-4 w-4" />{saving ? "Menyimpan..." : "Save to Cloud"}</Button>
        <Button onClick={() => setModalOpen(true)} className="h-11 rounded-xl bg-blue-600 px-5 font-bold hover:bg-blue-700"><Plus className="h-4 w-4" /> Input Data Omzet</Button>
      </CardContent>
    </Card>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-white pb-4">
        <CardTitle className="text-xl text-slate-900">YTD Control Omzet {selectedYear}</CardTitle>
        <CardDescription>Perbandingan omzet dan nilai terlapor per masa pajak. Geser tabel untuk melihat seluruh entity.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 font-sans text-xs text-slate-700">
            <thead className="sticky top-0 z-20">
              <tr>
                <th rowSpan={3} className="sticky left-0 z-40 min-w-24 border-b border-r border-slate-400 bg-slate-900 px-4 py-3 text-center text-base font-black text-white shadow-[2px_0_0_#94a3b8]">Masa</th>
                {visibleGroups.map((group) => <th key={group.name} colSpan={group.entities.reduce((columns, entity) => columns + (isObsidianUnreported(group.name, entity) ? 1 : 2), 0)} className={`border-b border-r border-white/30 px-3 py-3 text-center text-base font-black tracking-wide ${GROUP_COLORS[group.name].group}`}>{group.name}</th>)}
              </tr>
              <tr>{visibleGroups.flatMap((group) => group.entities.map((entity) => <th key={`${group.name}-${entity}`} colSpan={isObsidianUnreported(group.name, entity) ? 1 : 2} rowSpan={isObsidianUnreported(group.name, entity) ? 2 : 1} className={`min-w-52 border-b border-r border-slate-300 px-3 py-3 text-center text-sm font-extrabold shadow-inner ${GROUP_COLORS[group.name].entity}`}>{entity}</th>))}</tr>
              <tr>{visibleGroups.flatMap((group) => group.entities.flatMap((entity) => isObsidianUnreported(group.name, entity) ? [] : ([<th key={`${entity}-omzet`} className={`min-w-32 border-b border-r border-slate-300 px-3 py-2 text-center text-sm font-extrabold ${GROUP_COLORS[group.name].sub}`}>Omset</th>, <th key={`${entity}-terlapor`} className={`min-w-32 border-b border-r border-slate-300 px-3 py-2 text-center text-sm font-extrabold ${GROUP_COLORS[group.name].sub}`}>Terlapor</th>])))}</tr>
            </thead>
            <tbody>
              {visibleMonths.map((masa, index) => <tr key={masa} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-inherit px-4 py-3 text-left font-bold text-slate-800 shadow-[2px_0_0_#e2e8f0]">{MONTH_LABELS[CONTROL_OMZET_MONTHS.indexOf(masa)]} {String(selectedYear).slice(-2)}</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => isObsidianUnreported(group.name, entity) ? [<td key={`${masa}-${entity}`} className="border-b border-r border-slate-200 px-3 py-3 text-right tabular-nums">{number(obsidianUnreportedValue(masa))}</td>] : (["omzet", "terlapor"] as const).map((key) => <td key={`${masa}-${entity}-${key}`} className="border-b border-r border-slate-200 px-3 py-3 text-right tabular-nums">{number(cellValue(masa, group.name, entity, key))}</td>)))}
              </tr>)}
              <tr className="bg-slate-800 font-extrabold text-white">
                <th className="sticky left-0 z-10 border-r border-slate-600 bg-slate-900 px-4 py-3 text-center text-sm shadow-[2px_0_0_#475569]">Total</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => isObsidianUnreported(group.name, entity) ? [<td key={`total-${entity}`} className="border-r border-slate-600 px-3 py-3 text-right tabular-nums">{number(obsidianUnreportedTotal())}</td>] : (["omzet", "terlapor"] as const).map((key) => <td key={`total-${entity}-${key}`} className="border-r border-slate-600 px-3 py-3 text-right tabular-nums">{number(totalValue(group.name, entity, key))}</td>)))}
              </tr>
              <tr className="bg-slate-100 font-semibold italic text-slate-800">
                <th className="sticky left-0 z-10 border-r border-t border-slate-300 bg-slate-200 px-4 py-3 text-center text-sm font-extrabold shadow-[2px_0_0_#cbd5e1]">Sisa</th>
                {visibleGroups.flatMap((group) => group.entities.flatMap((entity) => {
                  if (isObsidianUnreported(group.name, entity)) {
                    const remaining = ANNUAL_OMZET_LIMIT - obsidianUnreportedTotal();
                    return [<td key={`sisa-${entity}`} className={`border-r border-t px-3 py-3 text-right tabular-nums ${remaining < 0 ? "border-red-200 bg-red-100 font-bold not-italic text-red-700" : "border-slate-300"}`}>{number(remaining)}</td>];
                  }
                  if (EMPTY_REMAINING_ENTITIES.has(entity)) return (["omzet", "terlapor"] as const).map((key) => <td key={`sisa-${entity}-${key}`} aria-label={`Sisa ${entity} tidak diperhitungkan`} className="border-r border-t border-slate-400 bg-slate-300 px-3 py-3" />);
                  return (["omzet", "terlapor"] as const).map((key) => {
                    const remaining = remainingValue(group.name, entity, key);
                    return <td key={`sisa-${entity}-${key}`} className={`border-r border-t px-3 py-3 text-right tabular-nums ${remaining < 0 ? "border-red-200 bg-red-100 font-bold not-italic text-red-700" : "border-slate-300"}`}>{number(remaining)}</td>;
                  });
                }))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="input-omzet-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><h2 id="input-omzet-title" className="text-xl font-black text-slate-950">Input Data Omzet</h2><Button variant="ghost" size="icon" onClick={() => { setModalOpen(false); setFormError(""); }}><X className="h-5 w-5" /></Button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormSelect label="Tahun" value={form.tahun} onChange={(value) => setForm({ ...form, tahun: value })} options={["2026"]} />
          <FormSelect label="Masa Pajak" value={form.masa} onChange={(value) => setForm({ ...form, masa: value })} options={MONTH_LABELS.map((month) => `${month} 26`)} placeholder="Pilih Masa Pajak" />
          <FormSelect label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value, entity: "" })} options={CONTROL_OMZET_GROUPS.map((group) => group.name)} placeholder="Pilih Group" />
          <FormSelect label="Entity" value={form.entity} onChange={(value) => setForm({ ...form, entity: value })} options={CONTROL_OMZET_GROUPS.find((group) => group.name === form.group)?.entities ?? []} placeholder="Pilih Entity" />
          <FormInput label="Omset" value={form.omzet} onChange={(value) => setForm({ ...form, omzet: value })} />
          <FormInput label="Terlapor" value={form.terlapor} onChange={(value) => setForm({ ...form, terlapor: value })} />
          <label className="space-y-2 sm:col-span-2"><span className="text-sm font-bold text-slate-700">Keterangan</span><textarea value={form.keterangan} onChange={(event) => setForm({ ...form, keterangan: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></label>
          {formError && <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5"><Button variant="outline" onClick={() => { setModalOpen(false); setFormError(""); }}>Batal</Button><Button onClick={saveManualInput} disabled={saving} className="bg-blue-600 hover:bg-blue-700">Simpan</Button></div>
      </div>
    </div>}
  </div>;
}

function FormSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; placeholder?: string }) {
  return <label className="space-y-2"><span className="text-sm font-bold text-slate-700">{label}</span><Select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl"><option value="">{placeholder ?? label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>;
}
function FormInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="text-sm font-bold text-slate-700">{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></label>;
}
