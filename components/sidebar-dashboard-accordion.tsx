"use client";

import { useEffect } from "react";

const DASHBOARD_LABELS = new Set(["DASHBOARD TAX", "DASHBOARD FINANCE", "DASHBOARD LEGAL"]);

export function SidebarDashboardAccordion() {
  useEffect(() => {
    let openDashboard: string | null = null;
    let applying = false;

    const getSections = () => {
      const nav = document.querySelector("aside nav");
      if (!nav) return [] as { header: HTMLElement; content: HTMLElement; label: string }[];

      return Array.from(nav.children).flatMap((section) => {
        if (!(section instanceof HTMLElement)) return [];
        const header = section.firstElementChild;
        const content = header?.nextElementSibling;
        if (!(header instanceof HTMLElement) || !(content instanceof HTMLElement)) return [];
        const label = header.textContent?.trim().toUpperCase() ?? "";
        if (!DASHBOARD_LABELS.has(label)) return [];
        return [{ header, content, label }];
      });
    };

    const applyState = () => {
      if (applying) return;
      applying = true;
      for (const { header, content, label } of getSections()) {
        const expanded = openDashboard === label;
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", String(expanded));
        header.style.cursor = "pointer";
        content.hidden = !expanded;
      }
      applying = false;
    };

    const toggleHeader = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const header = target.closest("aside nav > div > p");
      if (!(header instanceof HTMLElement)) return false;
      const label = header.textContent?.trim().toUpperCase() ?? "";
      if (!DASHBOARD_LABELS.has(label)) return false;
      openDashboard = openDashboard === label ? null : label;
      applyState();
      return true;
    };

    const onClick = (event: MouseEvent) => {
      toggleHeader(event.target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (toggleHeader(event.target)) event.preventDefault();
    };

    applyState();
    const observer = new MutationObserver(() => applyState());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      for (const { header, content } of getSections()) {
        header.removeAttribute("role");
        header.removeAttribute("tabindex");
        header.removeAttribute("aria-expanded");
        header.style.cursor = "";
        content.hidden = false;
      }
    };
  }, []);

  return null;
}
