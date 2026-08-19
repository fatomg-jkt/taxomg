"use client";

import { useEffect } from "react";

const TOP_LEVEL_LABELS = ["DASHBOARD TAX", "DASHBOARD LEGAL", "DASHBOARD FINANCE"] as const;
const STANDALONE_LABEL = "PENGAJUAN PEMBAYARAN";
type TopLevelLabel = (typeof TOP_LEVEL_LABELS)[number];

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

export function SidebarDashboardAccordion() {
  useEffect(() => {
    let frame = 0;
    let openLabel: TopLevelLabel | null = null;
    let applying = false;
    let initialized = false;

    const enforceState = () => {
      if (applying) return;
      const buttons = topLevelButtons();
      if (!buttons.length) return;

      applying = true;
      try {
        // Saat pertama kali sidebar muncul, semua submenu wajib tertutup.
        // Submenu baru boleh terbuka setelah parent Dashboard diklik user.
        if (!initialized) {
          for (const button of buttons) {
            if (button.getAttribute("aria-expanded") === "true") button.click();
          }
          openLabel = null;
          initialized = true;
          return;
        }

        for (const button of buttons) {
          const label = buttonLabel(button) as TopLevelLabel;
          const shouldOpen = openLabel === label;
          const isOpen = button.getAttribute("aria-expanded") === "true";
          if (isOpen !== shouldOpen) button.click();
        }
      } finally {
        applying = false;
      }
    };

    const onClick = (event: MouseEvent) => {
      if (applying) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("aside button");
      if (!(button instanceof HTMLButtonElement)) return;
      const label = buttonLabel(button);

      if (TOP_LEVEL_LABELS.includes(label as TopLevelLabel)) {
        const clickedLabel = label as TopLevelLabel;
        // Native Sidebar tetap menangani buka/tutup parent yang diklik.
        // Setelah React selesai update, sinkronkan state dan tutup parent lain.
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const current = topLevelButtons().find((item) => buttonLabel(item) === clickedLabel);
          openLabel = current?.getAttribute("aria-expanded") === "true" ? clickedLabel : null;
          enforceState();
        });
        return;
      }

      if (label === STANDALONE_LABEL) {
        openLabel = null;
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(enforceState);
      }
      // Klik anak submenu sengaja tidak mengubah openLabel,
      // jadi parent yang sedang aktif tetap terbuka.
    };

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(enforceState);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    document.addEventListener("click", onClick, true);
    frame = window.requestAnimationFrame(enforceState);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
