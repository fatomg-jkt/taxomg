"use client";

import { useEffect } from "react";

const TOP_LEVEL_LABELS = ["DASHBOARD TAX", "DASHBOARD LEGAL", "DASHBOARD FINANCE"] as const;
const STANDALONE_LABEL = "PENGAJUAN PEMBAYARAN";
type TopLevelLabel = (typeof TOP_LEVEL_LABELS)[number];

type Section = {
  label: TopLevelLabel;
  header: HTMLElement;
  body: HTMLElement;
};

function normalizeLabel(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function getSections(): Section[] {
  const nav = document.querySelector("aside nav");
  if (!nav) return [];

  return Array.from(nav.children).flatMap((node) => {
    if (!(node instanceof HTMLElement)) return [];
    const header = node.firstElementChild;
    const body = header?.nextElementSibling;
    if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement)) return [];
    const label = normalizeLabel(header.textContent);
    if (!TOP_LEVEL_LABELS.includes(label as TopLevelLabel)) return [];
    return [{ label: label as TopLevelLabel, header, body }];
  });
}

export function SidebarDashboardAccordion() {
  useEffect(() => {
    let openLabel: TopLevelLabel | null = null;
    let frame = 0;
    let applying = false;

    const applyState = () => {
      if (applying) return;
      const sections = getSections();
      if (!sections.length) return;

      applying = true;
      try {
        for (const section of sections) {
          const expanded = openLabel === section.label;
          section.header.setAttribute("role", "button");
          section.header.setAttribute("tabindex", "0");
          section.header.setAttribute("aria-expanded", String(expanded));
          section.header.style.cursor = "pointer";
          section.header.style.userSelect = "none";
          section.body.hidden = !expanded;
        }
      } finally {
        applying = false;
      }
    };

    const toggleHeader = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const header = target.closest("aside nav > div > p");
      if (!(header instanceof HTMLElement)) return false;
      const label = normalizeLabel(header.textContent);
      if (!TOP_LEVEL_LABELS.includes(label as TopLevelLabel)) return false;

      const clicked = label as TopLevelLabel;
      openLabel = openLabel === clicked ? null : clicked;
      applyState();
      return true;
    };

    const onClick = (event: MouseEvent) => {
      if (toggleHeader(event.target)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("aside button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (normalizeLabel(button.textContent) !== STANDALONE_LABEL) return;

      openLabel = null;
      applyState();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (toggleHeader(event.target)) event.preventDefault();
    };

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyState);
    });

    // Default: seluruh isi Dashboard Tax/Legal/Finance disembunyikan.
    // Isi baru muncul setelah judul Dashboard terkait diklik.
    frame = window.requestAnimationFrame(applyState);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      for (const section of getSections()) {
        section.header.removeAttribute("role");
        section.header.removeAttribute("tabindex");
        section.header.removeAttribute("aria-expanded");
        section.header.style.cursor = "";
        section.header.style.userSelect = "";
        section.body.hidden = false;
      }
    };
  }, []);

  return null;
}
