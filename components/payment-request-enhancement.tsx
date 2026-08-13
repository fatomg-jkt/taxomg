"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ReceiptText } from "lucide-react";
import { PaymentRequestDashboard } from "@/components/payment-request-dashboard";

const PAGE_ID = "paymentRequest";

function currentPage() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("page") || "";
}

function findFinanceContent() {
  const nav = document.querySelector("aside nav");
  if (!nav) return null;
  for (const section of Array.from(nav.children)) {
    if (!(section instanceof HTMLElement)) continue;
    const header = section.firstElementChild;
    const content = header?.nextElementSibling;
    if (!(header instanceof HTMLElement) || !(content instanceof HTMLElement)) continue;
    if (header.textContent?.trim().toUpperCase() === "DASHBOARD FINANCE") return content;
  }
  return null;
}

export function PaymentRequestEnhancement() {
  const [active, setActive] = useState(false);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      const isActive = currentPage() === PAGE_ID;
      setActive(isActive);

      const financeContent = findFinanceContent();
      if (financeContent) {
        const cashflowButton = Array.from(financeContent.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Cashflow");
        if (cashflowButton) {
          let host = financeContent.querySelector<HTMLElement>(":scope > [data-payment-request-menu-host]");
          if (!host) {
            host = document.createElement("div");
            host.dataset.paymentRequestMenuHost = "true";
          }
          const cashflowWrapper = cashflowButton.parentElement;
          if (cashflowWrapper?.parentElement === financeContent) cashflowWrapper.insertAdjacentElement("afterend", host);
          else cashflowButton.insertAdjacentElement("afterend", host);
          setMenuHost((current) => current === host ? current : host);
        }
      }

      const shell = document.querySelector<HTMLElement>("main > div.min-h-screen");
      if (shell) {
        let host = shell.querySelector<HTMLElement>(":scope > [data-payment-request-content-host]");
        if (!host) {
          host = document.createElement("div");
          host.dataset.paymentRequestContentHost = "true";
          shell.appendChild(host);
        }
        setContentHost((current) => current === host ? current : host);
        for (const child of Array.from(shell.children)) {
          if (!(child instanceof HTMLElement) || child === host || child.tagName === "HEADER") continue;
          child.style.display = isActive ? "none" : "";
        }
        host.style.display = isActive ? "block" : "none";
      }
    };

    const onNavigation = () => sync();
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = ((...args: Parameters<History["pushState"]>) => { originalPushState(...args); window.dispatchEvent(new Event("payment-request-navigation")); }) as History["pushState"];
    window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => { originalReplaceState(...args); window.dispatchEvent(new Event("payment-request-navigation")); }) as History["replaceState"];

    frame = window.requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("payment-request-navigation", onNavigation);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("payment-request-navigation", onNavigation);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      const shell = document.querySelector<HTMLElement>("main > div.min-h-screen");
      if (shell) {
        const host = shell.querySelector<HTMLElement>(":scope > [data-payment-request-content-host]");
        for (const child of Array.from(shell.children)) if (child instanceof HTMLElement && child !== host && child.tagName !== "HEADER") child.style.display = "";
      }
    };
  }, []);

  function navigate() {
    const url = new URL(window.location.href);
    url.searchParams.set("page", PAGE_ID);
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("payment-request-navigation"));
  }

  return <>
    {menuHost ? createPortal(<button onClick={navigate} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><ReceiptText className="h-5 w-5 shrink-0" /><span>Pengajuan Pembayaran</span></button>, menuHost) : null}
    {contentHost && active ? createPortal(<section className="space-y-6 p-4 sm:p-6 xl:p-8"><PaymentRequestDashboard /></section>, contentHost) : null}
  </>;
}
