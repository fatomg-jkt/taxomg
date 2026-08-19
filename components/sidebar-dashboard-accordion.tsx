"use client";

import { useEffect } from "react";

const TOP_LEVEL_LABELS = ["DASHBOARD TAX", "DASHBOARD LEGAL", "DASHBOARD FINANCE"] as const;
const STANDALONE_LABEL = "PENGAJUAN PEMBAYARAN";

function buttonLabel(button: HTMLButtonElement) {
  return (button.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function topLevelButtons() {
  const aside = document.querySelector("aside");
  if (!aside) return [] as HTMLButtonElement[];
  return Array.from(aside.querySelectorAll<HTMLButtonElement>("button")).filter((button) =>
    TOP_LEVEL_LABELS.some((label) => buttonLabel(button) === label),
  );
}

function closeOtherTopLevels(active: HTMLButtonElement | null) {
  for (const button of topLevelButtons()) {
    if (button === active) continue;
    if (button.getAttribute("aria-expanded") === "true") button.click();
  }
}

export function SidebarDashboardAccordion() {
  useEffect(() => {
    let frame = 0;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("aside button");
      if (!(button instanceof HTMLButtonElement)) return;
      const label = buttonLabel(button);

      if (TOP_LEVEL_LABELS.includes(label as (typeof TOP_LEVEL_LABELS)[number])) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => closeOtherTopLevels(button));
        return;
      }

      if (label === STANDALONE_LABEL) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => closeOtherTopLevels(null));
      }
      // Klik anak submenu tidak menutup parent-nya.
    };

    document.addEventListener("click", onClick, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
