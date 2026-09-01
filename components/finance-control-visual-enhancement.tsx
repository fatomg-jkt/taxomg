"use client";

import { useEffect } from "react";

const BRAND_COLORS: Record<string, { background: string; text: string }> = {
  "1001": { background: "#EC4899", text: "#FFFFFF" },
  "MAISON Y": { background: "#C026D3", text: "#FFFFFF" },
  "OBSIDIAN": { background: "#111827", text: "#FFFFFF" },
  "PADEL": { background: "#F59E0B", text: "#101011" },
  "GOSE": { background: "#7C3AED", text: "#FFFFFF" },
  "BAC": { background: "#1687D9", text: "#FFFFFF" },
  "OMG": { background: "#64748B", text: "#FFFFFF" },
  "PT GLOBAL SEHAT BERKARYA": { background: "#334155", text: "#FFFFFF" },
  "TRIPLE EGG": { background: "#10B981", text: "#101011" },
  "WOK": { background: "#DC2626", text: "#FFFFFF" },
  "HUNIAN": { background: "#FDE68A", text: "#101011" },
  "PT SEBELUM HINGGA SESUDAH": { background: "#047857", text: "#FFFFFF" },
  "RESTO": { background: "#059669", text: "#FFFFFF" },
};

const CONTROL_GROUP_COLORS: Record<string, { strong: string; entity: string; sub: string; body: string; text: string }> = {
  "1001": { strong: "#DB2777", entity: "#FCE7F3", sub: "#FDF2F8", body: "#FFF5FA", text: "#831843" },
  "OBSIDIAN": { strong: "#2563EB", entity: "#DBEAFE", sub: "#EFF6FF", body: "#F7FAFF", text: "#1E3A8A" },
  "RESTO": { strong: "#15803D", entity: "#BBF7D0", sub: "#DCFCE7", body: "#F4FFF7", text: "#14532D" },
  "MANAGEMENT": { strong: "#7E22CE", entity: "#E9D5FF", sub: "#F3E8FF", body: "#FBF7FF", text: "#581C87" },
};

function normalize(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function applySidebarLogoRemoval() {
  const aside = document.querySelector<HTMLElement>("main > aside");
  if (!aside) return;

  for (const image of Array.from(aside.querySelectorAll<HTMLImageElement>("img"))) {
    const alt = normalize(image.alt);
    if (alt.includes("OMG") || alt.includes("OBSIDIAN MANAGEMENT GROUP")) {
      image.style.setProperty("display", "none", "important");
    }
  }

  for (const paragraph of Array.from(aside.querySelectorAll<HTMLParagraphElement>("p"))) {
    if (normalize(paragraph.textContent) === "TAX, FINANCE & LEGAL") {
      paragraph.style.setProperty("display", "none", "important");
    }
  }

  const brandingWrapper = aside.querySelector<HTMLElement>("div.relative.mb-5.flex.justify-center");
  if (brandingWrapper) {
    brandingWrapper.style.setProperty("display", "none", "important");
  }
}

function applySidebarIdentity() {
  const aside = document.querySelector<HTMLElement>("main > aside");
  const nav = aside?.querySelector<HTMLElement>("nav");
  if (!aside || !nav) return;

  let identity = aside.querySelector<HTMLElement>("[data-sidebar-identity='true']");
  if (!identity) {
    identity = document.createElement("div");
    identity.dataset.sidebarIdentity = "true";
    identity.innerHTML = `
      <p data-sidebar-eyebrow>INTERNAL MANAGEMENT SYSTEM</p>
      <div data-sidebar-rule></div>
      <h2 data-sidebar-title>Dashboard<br />Finance, Tax &amp; Legal</h2>
      <p data-sidebar-office>Kantor Kencana</p>
    `;
    aside.insertBefore(identity, nav);
  }

  identity.style.setProperty("margin", "0 0 2rem", "important");
  identity.style.setProperty("padding", "0.1rem 0.35rem 1.75rem", "important");
  identity.style.setProperty("border-bottom", "1px solid rgba(246,243,238,0.16)", "important");
  identity.style.setProperty("color", "#F6F3EE", "important");
  identity.style.setProperty("text-align", "left", "important");

  const eyebrow = identity.querySelector<HTMLElement>("[data-sidebar-eyebrow]");
  if (eyebrow) {
    eyebrow.style.setProperty("margin", "0", "important");
    eyebrow.style.setProperty("font-family", "var(--mp-font-mono, 'DM Mono', monospace)", "important");
    eyebrow.style.setProperty("font-size", "0.62rem", "important");
    eyebrow.style.setProperty("font-weight", "500", "important");
    eyebrow.style.setProperty("line-height", "1.4", "important");
    eyebrow.style.setProperty("letter-spacing", "0.18em", "important");
    eyebrow.style.setProperty("color", "#DCE9F2", "important");
  }

  const rule = identity.querySelector<HTMLElement>("[data-sidebar-rule]");
  if (rule) {
    rule.style.setProperty("height", "1px", "important");
    rule.style.setProperty("margin", "0.9rem 0 1.3rem", "important");
    rule.style.setProperty("background", "rgba(246,243,238,0.16)", "important");
  }

  const title = identity.querySelector<HTMLElement>("[data-sidebar-title]");
  if (title) {
    title.style.setProperty("margin", "0", "important");
    title.style.setProperty("font-family", "var(--mp-font-text, Archivo, sans-serif)", "important");
    title.style.setProperty("font-size", "1.45rem", "important");
    title.style.setProperty("font-weight", "700", "important");
    title.style.setProperty("line-height", "1.08", "important");
    title.style.setProperty("letter-spacing", "-0.035em", "important");
    title.style.setProperty("color", "#F6F3EE", "important");
  }

  const office = identity.querySelector<HTMLElement>("[data-sidebar-office]");
  if (office) {
    office.style.setProperty("margin", "0.85rem 0 0", "important");
    office.style.setProperty("font-family", "var(--mp-font-text, Archivo, sans-serif)", "important");
    office.style.setProperty("font-size", "0.92rem", "important");
    office.style.setProperty("font-weight", "700", "important");
    office.style.setProperty("line-height", "1.3", "important");
    office.style.setProperty("color", "#F6F3EE", "important");
  }
}

function applyFinanceBrandCards() {
  const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>("main h2"));
  const heading = headings.find((node) => normalize(node.textContent) === "TOTAL SALDO PER BRAND");
  const grid = heading?.parentElement?.nextElementSibling;
  if (!(grid instanceof HTMLElement)) return;

  for (const card of Array.from(grid.children)) {
    if (!(card instanceof HTMLElement)) continue;
    const brandHeading = card.querySelector<HTMLHeadingElement>("h3");
    const brand = normalize(brandHeading?.textContent);
    const tone = BRAND_COLORS[brand];
    if (!tone) continue;

    card.dataset.financeBrand = brand;
    card.style.setProperty("background", tone.background, "important");
    card.style.setProperty("background-color", tone.background, "important");
    card.style.setProperty("background-image", "none", "important");
    card.style.setProperty("color", tone.text, "important");
    card.style.setProperty("border-color", tone.background, "important");

    const summaryContent = card.firstElementChild;
    if (summaryContent instanceof HTMLElement) {
      summaryContent.style.setProperty("background", "transparent", "important");
      summaryContent.style.setProperty("color", tone.text, "important");
      for (const node of Array.from(summaryContent.querySelectorAll<HTMLElement>("p,h3,span,svg"))) {
        node.style.setProperty("color", tone.text, "important");
      }
    }
  }
}

function applyControlOmzetColumns() {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("main table.w-max.min-w-full.border-separate"));
  for (const table of tables) {
    const headerRows = Array.from(table.tHead?.rows || []);
    if (!headerRows.length) continue;

    const firstRow = headerRows[0];
    const groupHeaders = Array.from(firstRow.cells).slice(1);
    const columnGroups: string[] = [];

    for (const header of groupHeaders) {
      const groupName = normalize(header.textContent);
      const palette = CONTROL_GROUP_COLORS[groupName];
      const span = Math.max(1, header.colSpan || 1);
      for (let index = 0; index < span; index += 1) columnGroups.push(groupName);
      if (!palette) continue;
      header.style.setProperty("background", palette.strong, "important");
      header.style.setProperty("background-color", palette.strong, "important");
      header.style.setProperty("color", "#FFFFFF", "important");
    }

    for (let rowIndex = 1; rowIndex < headerRows.length; rowIndex += 1) {
      let logicalColumn = 0;
      for (const header of Array.from(headerRows[rowIndex].cells)) {
        const groupName = columnGroups[logicalColumn];
        const palette = CONTROL_GROUP_COLORS[groupName];
        const span = Math.max(1, header.colSpan || 1);
        if (palette) {
          const background = rowIndex === 1 ? palette.entity : palette.sub;
          header.style.setProperty("background", background, "important");
          header.style.setProperty("background-color", background, "important");
          header.style.setProperty("color", palette.text, "important");
        }
        logicalColumn += span;
      }
    }

    for (const row of Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))) {
      const label = normalize(row.cells[0]?.textContent);
      const dataCells = Array.from(row.cells).slice(1);
      dataCells.forEach((cell, index) => {
        const groupName = columnGroups[index];
        const palette = CONTROL_GROUP_COLORS[groupName];
        if (!palette) return;

        if (label === "TOTAL") {
          cell.style.setProperty("background", palette.strong, "important");
          cell.style.setProperty("background-color", palette.strong, "important");
          cell.style.setProperty("color", "#FFFFFF", "important");
        } else {
          cell.style.setProperty("background", palette.body, "important");
          cell.style.setProperty("background-color", palette.body, "important");
          cell.style.setProperty("color", "#101011", "important");
        }
      });
    }
  }
}

export function FinanceControlVisualEnhancement() {
  useEffect(() => {
    let frame = 0;
    let applying = false;

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        applySidebarLogoRemoval();
        applySidebarIdentity();
        applyFinanceBrandCards();
        applyControlOmzetColumns();
      } finally {
        applying = false;
      }
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", schedule);
    };
  }, []);

  return null;
}
