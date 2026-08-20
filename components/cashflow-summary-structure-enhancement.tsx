"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RawEntry = {
  type?: string;
  nominal?: number;
  date?: string;
  week?: string;
  description?: string;
  notes?: string;
  debit?: number;
  credit?: number;
};

type RawMutation = { date?: string; balance?: number; debit?: number; credit?: number };
type RawCashflow = { projection?: RawEntry[]; actual?: RawEntry[]; bankMutation?: RawMutation[]; openingBalance?: number };

const PAGE_ID = "cashflow";
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const amount = (value: unknown) => { const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; };
const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLocaleLowerCase("id-ID");

function currentPage() { return new URLSearchParams(window.location.search).get("page") || ""; }
function weekNumber(value: unknown) { return Number(clean(value).match(/(\d{1,2})/)?.[1] ?? 0); }
function isTransfer(row: RawEntry) { const text = norm(`${row.type || ""} ${row.description || ""} ${row.notes || ""}`); return text.includes("pindah dana") || text.includes("pindah buku") || text.includes("transfer internal") || text.includes("transfer antar"); }
function isRevenue(row: RawEntry) { const text = norm(`${row.type || ""} ${row.description || ""}`); return text.includes("revenue") || text.includes("pendapatan") || text.includes("penerimaan") || text.includes("cash in") || text.includes("uang masuk"); }
function projectionIn(row: RawEntry) { return !isTransfer(row) && isRevenue(row) ? amount(row.nominal) : 0; }
function projectionOut(row: RawEntry) { return !isTransfer(row) && !isRevenue(row) ? amount(row.nominal) : 0; }
function actualIn(row: RawEntry) { if (isTransfer(row)) return 0; const debit = amount(row.debit); return debit > 0 ? debit : isRevenue(row) ? amount(row.nominal) : 0; }
function actualOut(row: RawEntry) { if (isTransfer(row)) return 0; const credit = amount(row.credit); return credit > 0 ? credit : !isRevenue(row) ? amount(row.nominal) : 0; }

function openingBalance(data: RawCashflow) {
  const explicit = amount(data.openingBalance);
  if (explicit) return explicit;
  const rows = [...(data.bankMutation ?? [])].filter((row) => row.date).sort((a, b) => clean(a.date).localeCompare(clean(b.date)));
  const first = rows[0];
  if (!first) return 0;
  return amount(first.balance) - amount(first.debit) + amount(first.credit);
}

function projectionSources(rows: RawEntry[]) {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const found = new Map<number, string>();
  for (const row of rows) {
    const date = new Date(clean(row.date));
    if (!Number.isNaN(date.getTime())) found.set(date.getMonth(), months[date.getMonth()]);
  }
  return Array.from(found.entries()).sort((a, b) => a[0] - b[0]).map(([, label]) => label).join(", ") || "-";
}

function findCashflowCard(title: string) {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).find((node) => node.textContent?.trim() === title);
  if (!heading) return null;
  let current: HTMLElement | null = heading;
  while (current && current.parentElement) {
    if (current.classList.contains("rounded-3xl")) return current;
    current = current.parentElement;
  }
  return null;
}

function SummaryCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "red" | "blue" | "yellow" }) {
  const toneClass = tone === "red" ? "bg-red-50 text-red-700" : tone === "blue" ? "bg-sky-50 text-slate-950" : tone === "yellow" ? "bg-yellow-100 text-slate-950" : "bg-white text-slate-950";
  return <div className={`border border-slate-300 p-3 text-center ${toneClass}`}><p className="text-xs font-bold text-slate-700">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}

export function CashflowSummaryStructureEnhancement() {
  const [data, setData] = useState<RawCashflow>({ projection: [], actual: [], bankMutation: [] });
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/cashflow-data", { cache: "no-store" });
        const payload = await response.json();
        const cloud = (payload.cashflowData ?? {}) as RawCashflow;
        let local: RawCashflow | null = null;
        try { const raw = localStorage.getItem("cashflowData"); if (raw) local = JSON.parse(raw) as RawCashflow; } catch {}
        const cloudCount = (cloud.projection?.length ?? 0) + (cloud.actual?.length ?? 0);
        const localCount = (local?.projection?.length ?? 0) + (local?.actual?.length ?? 0);
        if (!cancelled) setData(local && localCount > cloudCount ? local : cloud);
      } catch {}
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      const isActive = currentPage() === PAGE_ID;
      setActive(isActive);
      const ringkasan = findCashflowCard("Ringkasan Arus Kas");
      if (!ringkasan) { setHost(null); return; }
      let portalHost = ringkasan.parentElement?.querySelector<HTMLElement>(":scope > [data-cashflow-summary-structure-host]") ?? null;
      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.cashflowSummaryStructureHost = "true";
        ringkasan.insertAdjacentElement("afterend", portalHost);
      }
      setHost((current) => current === portalHost ? current : portalHost);
      portalHost.style.display = isActive ? "block" : "none";
    };
    sync();
    timer = window.setInterval(sync, 500);
    window.addEventListener("popstate", sync);
    window.addEventListener("focus", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("popstate", sync); window.removeEventListener("focus", sync); };
  }, []);

  const summary = useMemo(() => {
    const projection = data.projection ?? [];
    const actual = data.actual ?? [];
    const allWeeks = [...projection, ...actual].map((row) => weekNumber(row.week)).filter((week) => week > 0).sort((a, b) => a - b);
    const minWeek = allWeeks[0] ?? 0;
    const maxWeek = allWeeks[allWeeks.length - 1] ?? 0;
    const period = minWeek ? (minWeek === maxWeek ? `Week ${minWeek}` : `Week ${minWeek}-${maxWeek}`) : "-";
    const totalProjectionOut = projection.reduce((sum, row) => sum + projectionOut(row), 0);
    const totalActualOut = actual.reduce((sum, row) => sum + actualOut(row), 0);
    const totalProjectionIn = projection.reduce((sum, row) => sum + projectionIn(row), 0);
    const totalActualIn = actual.reduce((sum, row) => sum + actualIn(row), 0);
    const projectedByWeek = new Map<number, number>();
    for (const row of projection) {
      const week = weekNumber(row.week);
      const value = projectionIn(row);
      if (week && value) projectedByWeek.set(week, (projectedByWeek.get(week) ?? 0) + value);
    }
    const projectedWeeklyValues = Array.from(projectedByWeek.values()).filter((value) => value > 0);
    const projectedInPerWeek = projectedWeeklyValues.length ? projectedWeeklyValues.reduce((sum, value) => sum + value, 0) / projectedWeeklyValues.length : 0;
    const opening = openingBalance(data);
    const remaining = totalProjectionOut - totalActualOut;
    const realization = totalProjectionOut ? totalActualOut / totalProjectionOut * 100 : totalActualOut ? -1 : 0;
    const status = totalProjectionOut === 0 && totalActualOut === 0 ? "BELUM ADA DATA" : totalActualOut > totalProjectionOut ? "OVER" : totalActualOut === 0 ? "BELUM REALISASI" : "ON CASHFLOW";
    return {
      opening,
      projectedInPerWeek,
      sources: projectionSources(projection),
      totalProjectionOut,
      totalActualOut,
      remaining,
      realization,
      status,
      period,
      closingActual: opening + totalActualIn - totalActualOut,
      closingProjection: opening + totalProjectionIn - totalProjectionOut,
    };
  }, [data]);

  if (!host || !active) return null;

  const over = summary.status === "OVER";
  return createPortal(
    <Card className="mt-6 rounded-3xl">
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-400">
            <div className="grid grid-cols-[1.1fr_1fr] border-b border-slate-400"><div className="bg-slate-100 p-3 text-sm font-bold">Saldo Awal 2026</div><div className="p-3 text-right font-semibold">{rupiah(summary.opening)}</div></div>
            <div className="grid grid-cols-[1.1fr_1fr] border-b border-slate-400"><div className="bg-amber-50 p-3 text-sm font-bold text-amber-900">Proyeksi Cash In / Week</div><div className="bg-amber-50 p-3 text-right font-semibold text-amber-900">{rupiah(summary.projectedInPerWeek)}</div></div>
            <div className="grid grid-cols-[1.1fr_1fr]"><div className="bg-slate-100 p-3 text-sm font-bold">Sumber Proyeksi</div><div className="p-3 text-right text-sm font-semibold">{summary.sources}</div></div>
          </div>

          <div className="grid overflow-hidden rounded-xl border border-slate-400 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCell label="Total Proyeksi Out" value={rupiah(summary.totalProjectionOut)} />
            <SummaryCell label="Total Realisasi Out" value={rupiah(summary.totalActualOut)} />
            <SummaryCell label="Sisa Cashflow" value={rupiah(summary.remaining)} tone={summary.remaining < 0 ? "red" : "default"} />
            <SummaryCell label="Saldo Akhir Realisasi" value={rupiah(summary.closingActual)} tone="blue" />
            <SummaryCell label="Periode Aktif" value={summary.period} />
            <div className={`border border-slate-300 p-3 text-center ${over ? "bg-red-50" : "bg-white"}`}><p className="text-xs font-bold text-slate-700">Status Total</p><div className="mt-1"><Badge className={over ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{over ? "⚠ OVER" : summary.status}</Badge></div></div>
            <SummaryCell label="% Realisasi" value={summary.realization < 0 ? "-" : `${summary.realization.toFixed(0)}%`} />
            <SummaryCell label="Saldo Akhir Proyeksi" value={rupiah(summary.closingProjection)} tone="yellow" />
          </div>
        </div>
      </CardContent>
    </Card>,
    host,
  );
}
