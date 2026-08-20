"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BadgeDollarSign, PiggyBank, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RawEntry = {
  type?: string;
  nominal?: number;
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
function isTransfer(row: RawEntry) { const text = norm(`${row.type || ""} ${row.description || ""} ${row.notes || ""}`); return text.includes("pindah dana") || text.includes("pindah buku") || text.includes("transfer internal") || text.includes("transfer antar"); }
function isRevenue(row: RawEntry) { const text = norm(`${row.type || ""} ${row.description || ""}`); return text.includes("revenue") || text.includes("pendapatan") || text.includes("penerimaan") || text.includes("cash in") || text.includes("uang masuk"); }
function projectionOut(row: RawEntry) { return !isTransfer(row) && !isRevenue(row) ? amount(row.nominal) : 0; }
function actualOut(row: RawEntry) { if (isTransfer(row)) return 0; const credit = amount(row.credit); return credit > 0 ? credit : !isRevenue(row) ? amount(row.nominal) : 0; }

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

function restoreElement(element: HTMLElement | null) {
  if (!element || element.dataset.cashflowSummaryHidden !== "true") return;
  element.style.display = element.dataset.cashflowSummaryPreviousDisplay || "";
  delete element.dataset.cashflowSummaryHidden;
  delete element.dataset.cashflowSummaryPreviousDisplay;
}

function hideElement(element: HTMLElement | null) {
  if (!element) return;
  if (element.dataset.cashflowSummaryHidden !== "true") {
    element.dataset.cashflowSummaryHidden = "true";
    element.dataset.cashflowSummaryPreviousDisplay = element.style.display;
  }
  element.style.display = "none";
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
      const kpiGrid = ringkasan?.previousElementSibling instanceof HTMLElement ? ringkasan.previousElementSibling : null;

      if (!ringkasan || !kpiGrid || !ringkasan.parentElement) {
        setHost(null);
        return;
      }

      let portalHost = ringkasan.parentElement.querySelector<HTMLElement>(":scope > [data-cashflow-summary-structure-host]");
      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.cashflowSummaryStructureHost = "true";
        kpiGrid.insertAdjacentElement("beforebegin", portalHost);
      }
      setHost((current) => current === portalHost ? current : portalHost);

      if (isActive) {
        hideElement(kpiGrid);
        hideElement(ringkasan);
        portalHost.style.display = "block";
      } else {
        restoreElement(kpiGrid);
        restoreElement(ringkasan);
        portalHost.style.display = "none";
      }
    };

    sync();
    timer = window.setInterval(sync, 500);
    window.addEventListener("popstate", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("focus", sync);
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-cashflow-summary-hidden='true']"))) restoreElement(element);
    };
  }, []);

  const summary = useMemo(() => {
    const projection = data.projection ?? [];
    const actual = data.actual ?? [];
    const totalProjection = projection.reduce((sum, row) => sum + projectionOut(row), 0);
    const totalActual = actual.reduce((sum, row) => sum + actualOut(row), 0);
    const remaining = totalProjection - totalActual;
    const realization = totalProjection ? totalActual / totalProjection * 100 : totalActual ? -1 : 0;
    const status = totalProjection === 0 && totalActual === 0 ? "BELUM ADA DATA" : totalActual > totalProjection ? "OVER CASHFLOW" : totalActual === 0 ? "BELUM REALISASI" : "ON CASHFLOW";
    return { totalProjection, totalActual, remaining, realization, status };
  }, [data]);

  if (!host || !active) return null;

  const over = summary.status === "OVER CASHFLOW";

  return createPortal(
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardContent className="p-5">
          <h2 className="text-base font-bold text-slate-950">Ringkasan Arus Kas</h2>
          <p className="mt-1 text-sm text-slate-600">Revenue dihitung sebagai Cash In. Fix Cost, Project Cost, dan Asset dihitung sebagai Cash Out. Pindah Dana tidak masuk perhitungan Cash Out.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-3xl border-2 border-blue-500 bg-blue-50/70">
          <CardContent className="p-5">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><Target className="h-5 w-5" /></div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Total Proyeksi</p>
            <p className="mt-3 text-xl font-black text-slate-950">{rupiah(summary.totalProjection)}</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-emerald-500 bg-emerald-50/70">
          <CardContent className="p-5">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><BadgeDollarSign className="h-5 w-5" /></div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Total Realisasi</p>
            <p className="mt-3 text-xl font-black text-slate-950">{rupiah(summary.totalActual)}</p>
          </CardContent>
        </Card>

        <Card className={`rounded-3xl border-2 ${summary.remaining < 0 ? "border-red-500 bg-red-50/70" : "border-amber-500 bg-amber-50/70"}`}>
          <CardContent className="p-5">
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${summary.remaining < 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}><PiggyBank className="h-5 w-5" /></div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Sisa Cashflow</p>
            <p className={`mt-3 text-xl font-black ${summary.remaining < 0 ? "text-red-600" : "text-slate-950"}`}>{rupiah(summary.remaining)}</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-violet-500 bg-violet-50/70">
          <CardContent className="p-5">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><TrendingUp className="h-5 w-5" /></div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">% Realisasi</p>
            <p className="mt-3 text-xl font-black text-slate-950">{summary.realization < 0 ? "-" : `${summary.realization.toFixed(1)}%`}</p>
          </CardContent>
        </Card>

        <Card className={`rounded-3xl border-2 ${over ? "border-red-500 bg-red-50/70" : "border-emerald-500 bg-emerald-50/70"}`}>
          <CardContent className="p-5">
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${over ? "bg-red-100 text-red-600" : "bg-white text-slate-600"}`}><AlertTriangle className="h-5 w-5" /></div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Status Cashflow</p>
            <div className="mt-3"><Badge className={over ? "bg-red-100 text-red-700" : summary.status === "ON CASHFLOW" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{summary.status}</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>,
    host,
  );
}
