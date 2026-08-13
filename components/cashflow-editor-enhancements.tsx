"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
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
  return { actions, table };
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

export function CashflowEditorEnhancements() {
  const [query, setQuery] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);

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
      host?.remove();
    };
  }, [query]);

  if (!host) return null;

  return createPortal(
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
  );
}
