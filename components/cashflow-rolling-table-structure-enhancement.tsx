"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EMPTY_CASHFLOW, normalizeCashflow, safeAmount, type CashflowData, type CashflowEntry } from "@/lib/cashflow";

const PAGE_ID = "cashflow";
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLocaleLowerCase("id-ID");

function currentPage() {
  return new URLSearchParams(window.location.search).get("page") || "";
}

function weekOf(value: unknown) {
  const match = clean(value).match(/(\d{1,2})/);
  return match ? `Week ${match[1]}` : "-";
}

function isTransfer(row: CashflowEntry) {
  const text = norm(`${row.type} ${row.description} ${row.notes || ""}`);
  return text.includes("pindah dana") || text.includes("pindah buku") || text.includes("transfer internal") || text.includes("transfer antar");
}

function isRevenue(row: CashflowEntry) {
  const text = norm(`${row.type} ${row.description}`);
  return text.includes("revenue") || text.includes("pendapatan") || text.includes("penerimaan") || text.includes("cash in") || text.includes("uang masuk");
}

function projectionCashIn(row: CashflowEntry) {
  return !isTransfer(row) && isRevenue(row) ? safeAmount(row.nominal) : 0;
}

function projectionCashOut(row: CashflowEntry) {
  return !isTransfer(row) && !isRevenue(row) ? safeAmount(row.nominal) : 0;
}

function actualCashIn(row: CashflowEntry) {
  if (isTransfer(row)) return 0;
  const debit = safeAmount((row as CashflowEntry & { debit?: number }).debit);
  return debit > 0 ? debit : isRevenue(row) ? safeAmount(row.nominal) : 0;
}

function actualCashOut(row: CashflowEntry) {
  if (isTransfer(row)) return 0;
  const credit = safeAmount((row as CashflowEntry & { credit?: number }).credit);
  return credit > 0 ? credit : !isRevenue(row) ? safeAmount(row.nominal) : 0;
}

function periodForRows(rows: CashflowEntry[]) {
  const dates = rows
    .map((row) => new Date(row.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return "-";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.getMonth() === last.getMonth()) return `${first.getDate()}-${last.getDate()} ${months[first.getMonth()]}`;
  return `${first.getDate()} ${months[first.getMonth()]}-${last.getDate()} ${months[last.getMonth()]}`;
}

function initialOpeningBalance(data: CashflowData) {
  const explicit = safeAmount((data as CashflowData & { openingBalance?: number }).openingBalance);
  if (explicit) return explicit;
  const mutations = [...data.bankMutation]
    .filter((row) => row.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = mutations[0];
  if (!first) return 0;
  return safeAmount(first.balance) - safeAmount(first.debit) + safeAmount(first.credit);
}

function statusOf(projectionOut: number, actualOut: number) {
  if (!projectionOut && !actualOut) return "BELUM ADA DATA";
  if (!actualOut) return "BELUM REALISASI";
  if (!projectionOut) return "TIDAK DIPROYEKSI";
  return actualOut > projectionOut ? "OVER" : "ON CASHFLOW";
}

function statusClass(value: string) {
  if (value === "OVER") return "bg-red-100 text-red-700";
  if (value === "ON CASHFLOW") return "bg-emerald-100 text-emerald-700";
  if (value === "TIDAK DIPROYEKSI") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function findRollingCard() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).find((node) => node.textContent?.trim() === "Rolling Cashflow per Week");
  if (!heading) return null;
  let current: HTMLElement | null = heading;
  while (current && current.parentElement) {
    if (current.classList.contains("rounded-3xl")) return current;
    current = current.parentElement;
  }
  return null;
}

export function CashflowRollingTableStructureEnhancement() {
  const [data, setData] = useState<CashflowData>(EMPTY_CASHFLOW);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/cashflow-data", { cache: "no-store" });
        const payload = await response.json();
        const cloud = normalizeCashflow(payload.cashflowData);
        let local = EMPTY_CASHFLOW;
        try {
          const raw = localStorage.getItem("cashflowData");
          if (raw) local = normalizeCashflow(JSON.parse(raw));
        } catch {}
        const cloudCount = cloud.projection.length + cloud.actual.length;
        const localCount = local.projection.length + local.actual.length;
        if (!cancelled) setData(localCount > cloudCount ? local : cloud);
      } catch {}
    };
    load();
    const refresh = window.setInterval(load, 3000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      const isActive = currentPage() === PAGE_ID;
      setActive(isActive);
      const card = findRollingCard();
      if (!card) {
        setHost(null);
        return;
      }
      let portalHost = card.parentElement?.querySelector<HTMLElement>(":scope > [data-expanded-rolling-cashflow-host]") ?? null;
      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.expandedRollingCashflowHost = "true";
        card.insertAdjacentElement("afterend", portalHost);
      }
      setHost((current) => current === portalHost ? current : portalHost);
      card.dataset.expandedRollingCashflowOriginal = "true";
      card.style.display = isActive ? "none" : "";
      portalHost.style.display = isActive ? "block" : "none";
    };

    sync();
    timer = window.setInterval(sync, 500);
    window.addEventListener("popstate", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("focus", sync);
      const card = document.querySelector<HTMLElement>("[data-expanded-rolling-cashflow-original='true']");
      if (card) card.style.display = "";
    };
  }, []);

  const rows = useMemo(() => {
    const weeks = Array.from(new Set([...data.projection.map((row) => weekOf(row.week)), ...data.actual.map((row) => weekOf(row.week))]))
      .filter((week) => week !== "-")
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));

    let opening = initialOpeningBalance(data);
    return weeks.map((week) => {
      const projectionRows = data.projection.filter((row) => weekOf(row.week) === week);
      const actualRows = data.actual.filter((row) => weekOf(row.week) === week);
      const projectedIn = projectionRows.reduce((sum, row) => sum + projectionCashIn(row), 0);
      const realizedIn = actualRows.reduce((sum, row) => sum + actualCashIn(row), 0);
      const projectedOut = projectionRows.reduce((sum, row) => sum + projectionCashOut(row), 0);
      const realizedOut = actualRows.reduce((sum, row) => sum + actualCashOut(row), 0);
      const variance = Math.abs(realizedOut - projectedOut);
      const realization = projectedOut ? realizedOut / projectedOut * 100 : realizedOut ? -1 : 0;
      const status = statusOf(projectedOut, realizedOut);
      const net = realizedIn - realizedOut;
      const closingActual = opening + net;
      const closingProjection = opening + projectedIn - projectedOut;
      const row = {
        week,
        period: periodForRows([...projectionRows, ...actualRows]),
        opening,
        projectedIn,
        realizedIn,
        projectedOut,
        realizedOut,
        variance,
        realization,
        status,
        net,
        closingActual,
        closingProjection,
      };
      opening = realizedIn !== 0 || realizedOut !== 0 ? closingActual : closingProjection;
      return row;
    });
  }, [data]);

  if (!host || !active) return null;

  return createPortal(
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Rolling Cashflow per Week</CardTitle>
        <CardDescription>Struktur mengikuti rolling cashflow: saldo awal, proyeksi & realisasi cash in, proyeksi & realisasi cash out, sisa/over, realisasi, net cashflow, serta saldo akhir realisasi dan proyeksi.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-[1700px]">
          <TableHeader>
            <TableRow>
              {["Week", "Periode", "Saldo Awal (Rp)", "Proyeksi Cash In (Rp)", "Realisasi Cash In (Rp)", "Proyeksi Cash Out (Rp)", "Realisasi Cash Out (Rp)", "Sisa/Over Cashflow (Rp)", "Realisasi (%)", "Status Cashflow", "Net Cashflow (Rp)", "Saldo Akhir Realisasi (Rp)", "Saldo Akhir Proyeksi (Rp)"].map((head) => <TableHead key={head}>{head}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((row) => <TableRow key={row.week}>
              <TableCell className="font-bold">{row.week}</TableCell>
              <TableCell>{row.period}</TableCell>
              <TableCell>{rupiah(row.opening)}</TableCell>
              <TableCell>{rupiah(row.projectedIn)}</TableCell>
              <TableCell>{rupiah(row.realizedIn)}</TableCell>
              <TableCell>{rupiah(row.projectedOut)}</TableCell>
              <TableCell>{rupiah(row.realizedOut)}</TableCell>
              <TableCell className={row.status === "OVER" ? "font-bold text-red-600" : "font-bold text-emerald-700"}>{rupiah(row.variance)}</TableCell>
              <TableCell className={row.status === "OVER" ? "font-bold text-red-600" : ""}>{row.realization < 0 ? "-" : `${row.realization.toFixed(0)}%`}</TableCell>
              <TableCell><Badge className={statusClass(row.status)}>{row.status}</Badge></TableCell>
              <TableCell className={row.net < 0 ? "font-bold text-red-600" : "font-bold text-slate-950"}>{rupiah(row.net)}</TableCell>
              <TableCell className="font-bold">{rupiah(row.closingActual)}</TableCell>
              <TableCell className="font-bold">{rupiah(row.closingProjection)}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={13} className="h-24 text-center text-slate-500">Belum ada data Cashflow.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>,
    host,
  );
}
