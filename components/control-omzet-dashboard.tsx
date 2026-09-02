"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Cloud, Plus, X } from "lucide-react";
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
  const [openGroup, setOpenGroup] = useState("");

  const years = useMemo(() => Array.from(new Set(data.map((row) => safeNumber(row.tahun)).filter(Boolean))).sort(), [data]);
  const selectedYear = filters.tahun === ALL ? (years.at(-1) ?? 2026) : Number(filters.tahun);
  const availableEntities = useMemo(() => CONTROL_OMZET_GROUPS.flatMap((group) => group.entities.map((entity) => ({ group: group.name, entity }))), []);
  const visibleGroups = useMemo(() => CONTROL_OMZET_GROUPS.map((group) => ({ ...group, entities: group.entities.filter((entity) => (filters.group === ALL || group.name === filters.group) && (filters.entity === ALL || entity === filters.entity)) })).filter((group) => group.entities.length), [filters.group, filters.entity]);
  const visibleMonths = CONTROL_OMZET_MONTHS.filter((month) => filters.masa === ALL || month === filters.masa);
  const yearAndGroupRows = useMemo(() => data.filter((row) => safeNumber(row.tahun) === selectedYear && (filters.group === ALL || row.group === filters.group)), [data, filters.group, selectedYear]);
  const filtered = useMemo(() => yearAndGroupRows.filter((row) => filters.entity === ALL || row.entity === filters.entity), [filters.entity, yearAndGroupRows]);
  const activeGroupName = filters.group !== ALL ? filters.group : openGroup;
  const activeGroups = visibleGroups.filter((group) => group.name === activeGroupName);

  const cellValue = (masa: string, group: string, entity: string, key: "omzet" | "terlapor") => filtered.filter((row) => samePeriod(row.masa, masa, selectedYear) && row.group === group && row.entity === entity).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const totalValue = (group: string, entity: string, key: "omzet" | "terlapor") => visibleMonths.reduce((sum, masa) => sum + cellValue(masa, group, entity, key), 0);
  const obsidianEntityValue = (masa: string, entity: string, key: "omzet" | "terlapor") => yearAndGroupRows.filter((row) => samePeriod(row.masa, masa, selectedYear) && row.group === OBSIDIAN_GROUP && row.entity === entity).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const obsidianUnreportedValue = (masa: string) => obsidianEntityValue(masa, PGO_ENTITY, "omzet") + obsidianEntityValue(masa, STB_ENTITY, "omzet") - obsidianEntityValue(masa, PGO_ENTITY, "terlapor") - obsidianEntityValue(masa, STB_ENTITY, "terlapor");
  const obsidianUnreportedTotal = () => CONTROL_OMZET_MONTHS.reduce((sum, masa) => sum + obsidianUnreportedValue(masa), 0);
  const remainingValue = (group: string, entity: string, key: "omzet" | "terlapor") => ANNUAL_OMZET_LIMIT - totalValue(group, entity, key);
  const isObsidianUnreported = (group: string, entity: string) => group === OBSIDIAN_GROUP && entity === OBSIDIAN_UNREPORTED_ENTITY;
  const update = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "group" ? { entity: ALL } : {}) }));
    if (key === "group") setOpenGroup(value === ALL ? "" : value);
  };

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
    <Card className="border-[#DCD8D1] bg-[#F6F3EE] shadow-none">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        {([
          ["masa", "Semua Masa Pajak", [...CONTROL_OMZET_MONTHS]],
          ["group", "Semua Group", CONTROL_OMZET_GROUPS.map((group) => group.name)],
          ["entity", "Semua Entity", availableEntities.filter((item) => filters.group === ALL || item.group === filters.group).map((item) => item.entity)],
        ] as [keyof Filters, string, readonly string[]][]).map(([key, label, options]) => <Select key={key} value={filters[key]} onChange={(event) => update(key, event.target.value)} className="h-11 min-w-40 flex-1 border-[#DCD8D1] bg-[#F6F3EE]"><option value={ALL}>{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>)}
        <Button onClick={onSave} disabled={saving} variant="outline" className="h-11 px-5 font-bold"><Cloud className="h-4 w-4" />{saving ? "Menyimpan..." : "Save to Cloud"}</Button>
        <Button onClick={() => setModalOpen(true)} className="h-11 bg-[#D5D846] px-5 font-bold text-[#101011] hover:bg-[#C8CB3E]"><Plus className="h-4 w-4" /> Input Data Omzet</Button>
      </CardContent>
    </Card>
    {error && <div className="border border-[#D6396F] bg-[#F6F3EE] p-4 text-sm font-semibold text-[#D6396F]">{error}</div>}

    <Card className="overflow-hidden border-[#DCD8D1] bg-[#F6F3EE] shadow-none">
      <CardHeader className="border-b border-[#DCD8D1] bg-[#F6F3EE] pb-5">
        <CardTitle className="text-xl text-[#101011]">YTD Control Omzet {selectedYear}</CardTitle>
        <CardDescription className="text-[#6B6B68]">Pilih grup/brand di bawah untuk menampilkan tabel omzet per kelompok.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {visibleGroups.map((group) => {
            const expanded = activeGroupName === group.name;
            return <button
              key={group.name}
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpenGroup((current) => current === group.name ? "" : group.name)}
              className={`flex min-h-14 items-center justify-between gap-4 border px-4 py-3 text-left transition ${expanded ? "border-[#101011] bg-[#F6F3EE]" : "border-[#DCD8D1] bg-[#F6F3EE] hover:border-[#4F2958]"}`}
            >
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#4F2958]">Group / Brand</p>
                <p className="mt-1 font-bold text-[#101011]">{group.name}</p>
                <p className="mt-1 text-xs text-[#6B6B68]">{group.entities.length} entity</p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#101011] transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>;
          })}
        </div>

        {!activeGroups.length && <div className="border-y border-[#DCD8D1] py-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#4F2958]">Pilih Group / Brand</p>
          <p className="mt-2 text-sm text-[#6B6B68]">Klik salah satu grup di atas untuk membuka tabel Control Omzet.</p>
        </div>}

        {activeGroups.map((group) => <div key={group.name} className="border-t border-[#101011] pt-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#4F2958]">Control Omzet / {selectedYear}</p>
              <h3 className="mt-1 text-2xl font-bold text-[#101011]">{group.name}</h3>
            </div>
            <p className="text-sm text-[#6B6B68]">{group.entities.length} entity · {visibleMonths.length} masa pajak</p>
          </div>

          <div className="overflow-x-auto border border-[#DCD8D1] bg-[#F6F3EE]">
            <table className="w-max min-w-full border-collapse bg-[#F6F3EE] font-sans text-xs text-[#101011]">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 min-w-24 border-b border-r border-[#24358C] bg-[#24358C] px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#F6F3EE]">Masa</th>
                  {group.entities.map((entity) => <th key={`${group.name}-${entity}`} colSpan={isObsidianUnreported(group.name, entity) ? 1 : 2} rowSpan={isObsidianUnreported(group.name, entity) ? 2 : 1} className={`${isObsidianUnreported(group.name, entity) ? "w-36 min-w-36 max-w-36 whitespace-normal" : "min-w-56"} border-b border-r border-[#24358C] bg-[#4F2958] px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#F6F3EE]`}>{isObsidianUnreported(group.name, entity) ? <span>Omset Tidak<br />Terlapor<br />PGO + STB</span> : entity}</th>)}
                </tr>
                <tr>
                  {group.entities.flatMap((entity) => isObsidianUnreported(group.name, entity) ? [] : [
                    <th key={`${entity}-omzet`} className="min-w-32 border-b border-r border-[#C8C3BC] bg-[#DCE9F2] px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[#24358C]">Omset</th>,
                    <th key={`${entity}-terlapor`} className="min-w-32 border-b border-r border-[#C8C3BC] bg-[#DCE9F2] px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[#24358C]">Terlapor</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {visibleMonths.map((masa) => <tr key={masa} className="hover:bg-[#F0EDE7]">
                  <th className="sticky left-0 z-10 border-b border-r border-[#DCD8D1] bg-[#F6F3EE] px-4 py-3 text-left font-bold text-[#101011]">{MONTH_LABELS[CONTROL_OMZET_MONTHS.indexOf(masa)]} {String(selectedYear).slice(-2)}</th>
                  {group.entities.flatMap((entity) => {
                    if (isObsidianUnreported(group.name, entity)) {
                      return [<td key={`${masa}-${entity}`} className="w-36 min-w-36 max-w-36 border-b border-r border-[#DCD8D1] px-3 py-3 text-right tabular-nums">{number(obsidianUnreportedValue(masa))}</td>];
                    }
                    return (["omzet", "terlapor"] as const).map((key) => <td key={`${masa}-${entity}-${key}`} className="border-b border-r border-[#DCD8D1] px-3 py-3 text-right font-medium tabular-nums">{number(cellValue(masa, group.name, entity, key))}</td>);
                  })}
                </tr>)}

                <tr className="bg-[#101011] font-bold text-[#F6F3EE]">
                  <th className="sticky left-0 z-10 border-r border-[#353535] bg-[#101011] px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#F6F3EE]">Total</th>
                  {group.entities.flatMap((entity) => {
                    if (isObsidianUnreported(group.name, entity)) {
                      return [<td key={`total-${entity}`} className="w-36 min-w-36 max-w-36 border-r border-[#353535] px-3 py-3 text-right tabular-nums">{number(obsidianUnreportedTotal())}</td>];
                    }
                    return (["omzet", "terlapor"] as const).map((key) => <td key={`total-${entity}-${key}`} className="border-r border-[#353535] px-3 py-3 text-right tabular-nums">{number(totalValue(group.name, entity, key))}</td>);
                  })}
                </tr>

                <tr className="bg-[#D5D846] font-bold text-[#101011]">
                  <th className="sticky left-0 z-10 border-r border-[#BABD39] bg-[#D5D846] px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#101011]">Sisa</th>
                  {group.entities.flatMap((entity) => {
                    if (isObsidianUnreported(group.name, entity)) {
                      const remaining = ANNUAL_OMZET_LIMIT - obsidianUnreportedTotal();
                      return [<td key={`sisa-${entity}`} className={`w-36 min-w-36 max-w-36 border-r border-[#BABD39] px-3 py-3 text-right tabular-nums ${remaining < 0 ? "text-[#D6396F]" : ""}`}>{number(remaining)}</td>];
                    }
                    if (EMPTY_REMAINING_ENTITIES.has(entity)) return (["omzet", "terlapor"] as const).map((key) => <td key={`sisa-${entity}-${key}`} aria-label={`Sisa ${entity} tidak diperhitungkan`} className="border-r border-[#BABD39] px-3 py-3 text-center text-[#6B6B68]">—</td>);
                    return (["omzet", "terlapor"] as const).map((key) => {
                      const remaining = remainingValue(group.name, entity, key);
                      return <td key={`sisa-${entity}-${key}`} className={`border-r border-[#BABD39] px-3 py-3 text-right tabular-nums ${remaining < 0 ? "text-[#D6396F]" : ""}`}>{number(remaining)}</td>;
                    });
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>)}
      </CardContent>
    </Card>

    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="input-omzet-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#DCD8D1] bg-[#F6F3EE]">
        <div className="flex items-center justify-between border-b border-[#DCD8D1] p-5"><h2 id="input-omzet-title" className="text-xl font-black text-[#101011]">Input Data Omzet</h2><Button variant="ghost" size="icon" onClick={() => { setModalOpen(false); setFormError(""); }}><X className="h-5 w-5" /></Button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormSelect label="Tahun" value={form.tahun} onChange={(value) => setForm({ ...form, tahun: value })} options={["2026"]} />
          <FormSelect label="Masa Pajak" value={form.masa} onChange={(value) => setForm({ ...form, masa: value })} options={MONTH_LABELS.map((month) => `${month} 26`)} placeholder="Pilih Masa Pajak" />
          <FormSelect label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value, entity: "" })} options={CONTROL_OMZET_GROUPS.map((group) => group.name)} placeholder="Pilih Group" />
          <FormSelect label="Entity" value={form.entity} onChange={(value) => setForm({ ...form, entity: value })} options={CONTROL_OMZET_GROUPS.find((group) => group.name === form.group)?.entities ?? []} placeholder="Pilih Entity" />
          <FormInput label="Omset" value={form.omzet} onChange={(value) => setForm({ ...form, omzet: value })} />
          <FormInput label="Terlapor" value={form.terlapor} onChange={(value) => setForm({ ...form, terlapor: value })} />
          <label className="space-y-2 sm:col-span-2"><span className="text-sm font-bold text-[#101011]">Keterangan</span><textarea value={form.keterangan} onChange={(event) => setForm({ ...form, keterangan: event.target.value })} rows={3} className="w-full rounded-xl border border-[#DCD8D1] bg-[#F6F3EE] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#24358C]" /></label>
          {formError && <p className="sm:col-span-2 border border-[#D6396F] bg-[#F6F3EE] p-3 text-sm font-semibold text-[#D6396F]">{formError}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-[#DCD8D1] p-5"><Button variant="outline" onClick={() => { setModalOpen(false); setFormError(""); }}>Batal</Button><Button onClick={saveManualInput} disabled={saving} className="bg-[#D5D846] text-[#101011] hover:bg-[#C8CB3E]">Simpan</Button></div>
      </div>
    </div>}
  </div>;
}

function FormSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; placeholder?: string }) {
  return <label className="space-y-2"><span className="text-sm font-bold text-[#101011]">{label}</span><Select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full border-[#DCD8D1] bg-[#F6F3EE]"><option value="">{placeholder ?? label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>;
}
function FormInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="text-sm font-bold text-[#101011]">{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" className="h-11 w-full rounded-xl border border-[#DCD8D1] bg-[#F6F3EE] px-3 text-sm outline-none focus:ring-2 focus:ring-[#24358C]" /></label>;
}