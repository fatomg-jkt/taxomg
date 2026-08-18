"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { FileDown, FileSpreadsheet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EDITOR_TITLES = new Set(["Cashflow > Proyeksi", "Cashflow > Realisasi"]);

function findEditorElements() {
  const title = Array.from(document.querySelectorAll<HTMLParagraphElement>("p")).find((node) => EDITOR_TITLES.has(node.textContent?.trim() ?? ""));
  const cardContent = title?.parentElement?.parentElement;
  const actions = cardContent?.children[1] instanceof HTMLElement ? cardContent.children[1] : null;
  const table = Array.from(document.querySelectorAll<HTMLTableElement>("table")).find((node) => {
    const headers = Array.from(node.querySelectorAll("thead th")).map((head) => head.textContent?.trim());
    return headers.includes("Deskripsi") && headers.includes("JENIS") && headers.includes("Nominal") && headers.includes("Week");
  }) ?? null;
  return { actions, table, title: title?.textContent?.trim() ?? "" };
}

function applyTableLayout(table: HTMLTableElement | null, query: string) {
  if (!table) return;
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
  const actual = headers.some((head) => head.textContent?.trim() === "Keterangan");
  const widths = actual
    ? ["3%", "3.5%", "8%", "8%", "21%", "8%", "10%", "9%", "7%", "10%", "8%", "4.5%"]
    : ["3%", "4%", "9%", "9%", "27%", "9%", "11%", "10%", "8%", "6%", "4%"];

  table.style.width = "100%";
  table.style.minWidth = "0";
  table.style.tableLayout = "fixed";

  headers.forEach((head, index) => {
    head.style.width = widths[index] ?? "auto";
    head.style.paddingLeft = "8px";
    head.style.paddingRight = "8px";
    head.style.whiteSpace = "normal";
    head.style.overflowWrap = "break-word";
  });

  const descriptionIndex = headers.findIndex((head) => head.textContent?.trim() === "Deskripsi");
  Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr")).forEach((row) => {
    const cells = Array.from(row.children).filter((cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement);
    cells.forEach((cell, index) => {
      cell.style.width = widths[index] ?? "auto";
      cell.style.paddingLeft = "8px";
      cell.style.paddingRight = "8px";
      if (index === descriptionIndex) {
        cell.style.whiteSpace = "normal";
        cell.style.overflowWrap = "anywhere";
        cell.style.wordBreak = "break-word";
        cell.style.lineHeight = "1.4";
      }
    });

    const text = (row.textContent ?? "").toLocaleLowerCase("id-ID");
    row.style.display = !query || text.includes(query) ? "" : "none";
  });
}

function exportTableData(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map((head) => head.textContent?.trim() ?? "");
  const indexes = headers.map((header, index) => ({ header, index })).filter(({ header }) => header && header !== "Hapus");
  const exportHeaders = indexes.map(({ header }) => header);
  const nominalIndex = exportHeaders.findIndex((header) => header === "Nominal");
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))
    .filter((row) => row.style.display !== "none" && !row.querySelector("td[colspan]"))
    .map((row) => {
      const cells = Array.from(row.children).filter((cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement);
      return indexes.map(({ index }, exportIndex) => {
        const value = cells[index]?.textContent?.trim() ?? "";
        if (exportIndex === nominalIndex) {
          const numeric = Number(value.replace(/[^0-9-]/g, ""));
          return Number.isFinite(numeric) ? numeric : value;
        }
        return value;
      });
    });
  return { headers: exportHeaders, rows };
}

function exportFileName(title: string, extension: "xlsx" | "pdf") {
  const page = title.toLocaleLowerCase("id-ID").includes("realisasi") ? "realisasi" : "proyeksi";
  return `cashflow-${page}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function exportExcel() {
  const { table, title } = findEditorElements();
  if (!table) return;
  const data = exportTableData(table);
  if (!data.rows.length) { alert("Belum ada data untuk diekspor."); return; }
  const sheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  sheet["!cols"] = data.headers.map((header) => ({ wch: Math.max(12, Math.min(header === "Deskripsi" ? 42 : 22, header.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, title.includes("Realisasi") ? "Realisasi" : "Proyeksi");
  XLSX.writeFile(workbook, exportFileName(title, "xlsx"));
}

function exportPdf() {
  const { table, title } = findEditorElements();
  if (!table) return;
  const data = exportTableData(table);
  if (!data.rows.length) { alert("Belum ada data untuk diekspor."); return; }
  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (!printWindow) { alert("Popup diblokir browser. Izinkan popup lalu coba Export PDF lagi."); return; }
  const heading = title || "Cashflow";
  const tableHead = data.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tableBody = data.rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(exportFileName(title, "pdf"))}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:"Public Sans",Arial,sans-serif;color:#0f172a;margin:0}h1{font-family:"Playfair Display",Georgia,serif;font-size:24px;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left;vertical-align:top;word-break:break-word}th{background:#f1f5f9;font-weight:700}tr:nth-child(even) td{background:#f8fafc}</style></head><body><h1>${escapeHtml(heading)}</h1><table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

export function CashflowEditorEnhancements() {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [exportHost, setExportHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let applying = false;
    const sync = () => {
      if (applying) return;
      applying = true;
      const { actions, table } = findEditorElements();

      if (!actions || !table) {
        setHost((current) => {
          current?.remove();
          return null;
        });
        setExportHost((current) => {
          current?.remove();
          return null;
        });
        applying = false;
        return;
      }

      let searchHost = actions.querySelector<HTMLElement>("[data-cashflow-search-host]");
      if (!searchHost) {
        searchHost = document.createElement("div");
        searchHost.dataset.cashflowSearchHost = "true";
        searchHost.className = "relative min-w-[220px] flex-1 sm:max-w-[320px]";
        actions.prepend(searchHost);
      }
      setHost((current) => current === searchHost ? current : searchHost);

      let nextExportHost = actions.querySelector<HTMLElement>("[data-cashflow-export-host]");
      if (!nextExportHost) {
        nextExportHost = document.createElement("div");
        nextExportHost.dataset.cashflowExportHost = "true";
        nextExportHost.className = "contents";
        const uploadButton = Array.from(actions.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Upload Excel"));
        if (uploadButton) uploadButton.insertAdjacentElement("afterend", nextExportHost);
        else actions.appendChild(nextExportHost);
      }
      setExportHost((current) => current === nextExportHost ? current : nextExportHost);

      applyTableLayout(table, query.trim().toLocaleLowerCase("id-ID"));
      applying = false;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
      document.querySelector<HTMLElement>("[data-cashflow-search-host]")?.remove();
      document.querySelector<HTMLElement>("[data-cashflow-export-host]")?.remove();
    };
  }, [query]);

  return <>
    {host ? createPortal(
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search data..."
          className="h-10 w-full rounded-xl bg-white pl-9"
          aria-label="Search data cashflow"
        />
      </div>,
      host,
    ) : null}
    {exportHost ? createPortal(<>
      <Button onClick={exportExcel} variant="outline" className="rounded-xl"><FileSpreadsheet className="h-4 w-4"/> Export Excel</Button>
      <Button onClick={exportPdf} variant="outline" className="rounded-xl"><FileDown className="h-4 w-4"/> Export PDF</Button>
    </>, exportHost) : null}
  </>;
}
