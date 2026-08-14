"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PaymentRequestDashboard } from "@/components/payment-request-dashboard";

const PAGE_ID = "paymentRequest";
const PAYMENT_LABEL = "PENGAJUAN PEMBAYARAN";

function currentPage() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("page") || "";
}

function findSection(label: string) {
  const nav = document.querySelector("aside nav");
  if (!nav) return null;
  for (const child of Array.from(nav.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.textContent?.toUpperCase().includes(label.toUpperCase())) return child;
  }
  return null;
}

function hideNativePaymentButtons() {
  const aside = document.querySelector("aside");
  if (!aside) return;
  for (const button of Array.from(aside.querySelectorAll<HTMLButtonElement>("button"))) {
    const matches = button.textContent?.trim().toUpperCase() === "PENGAJUAN PEMBAYARAN";
    if (!matches || button.closest("[data-payment-request-dashboard-host]")) continue;
    button.dataset.paymentRequestNativeButton = "true";
    button.style.display = "none";
  }
}

function contentShell() {
  return document.querySelector<HTMLElement>("main > div.min-h-screen");
}

export function PaymentRequestEnhancement() {
  const [active, setActive] = useState(false);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let timer = 0;
    let observer: MutationObserver | null = null;

    const sync = () => {
      const aside = document.querySelector("aside");
      const shell = contentShell();
      const ready = Boolean(aside && shell);
      const isActive = ready && currentPage() === PAGE_ID;
      setActive(isActive);

      if (!ready) {
        setMenuHost(null);
        setContentHost(null);
        return;
      }

      hideNativePaymentButtons();

      const nav = document.querySelector("aside nav");
      const taxSection = findSection("DASHBOARD TAX");
      const legalSection = findSection("DASHBOARD LEGAL");
      const financeSection = findSection("DASHBOARD FINANCE");

      if (nav && taxSection && legalSection && financeSection) {
        if (taxSection.nextElementSibling !== legalSection) {
          taxSection.insertAdjacentElement("afterend", legalSection);
        }
        if (legalSection.nextElementSibling !== financeSection) {
          legalSection.insertAdjacentElement("afterend", financeSection);
        }
      }

      if (financeSection) {
        let host = aside!.querySelector<HTMLElement>("[data-payment-request-dashboard-host]");
        if (!host) {
          host = document.createElement("div");
          host.dataset.paymentRequestDashboardHost = "true";
        }
        const parent = financeSection.parentElement;
        if (parent && (host.parentElement !== parent || financeSection.nextElementSibling !== host)) {
          financeSection.insertAdjacentElement("afterend", host);
        }
        setMenuHost((current) => current === host ? current : host);
      }

      let host = shell!.querySelector<HTMLElement>(":scope > [data-payment-request-content-host]");
      if (!host) {
        host = document.createElement("div");
        host.dataset.paymentRequestContentHost = "true";
        shell!.appendChild(host);
      }
      setContentHost((current) => current === host ? current : host);

      for (const child of Array.from(shell!.children)) {
        if (!(child instanceof HTMLElement) || child === host || child.tagName === "HEADER") continue;
        const display = isActive ? "none" : "";
        if (child.style.display !== display) child.style.display = display;
      }
      host.style.display = isActive ? "block" : "none";
    };

    const onNavigation = () => sync();
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPushState(...args);
      window.dispatchEvent(new Event("payment-request-navigation"));
    }) as History["pushState"];
    window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplaceState(...args);
      window.dispatchEvent(new Event("payment-request-navigation"));
    }) as History["replaceState"];

    sync();
    timer = window.setInterval(sync, 500);
    observer = new MutationObserver(() => {
      hideNativePaymentButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("focus", onNavigation);
    window.addEventListener("payment-request-navigation", onNavigation);

    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("focus", onNavigation);
      window.removeEventListener("payment-request-navigation", onNavigation);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;

      for (const hiddenButton of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-payment-request-native-button]"))) {
        hiddenButton.style.display = "";
      }

      const shell = contentShell();
      if (shell) {
        const host = shell.querySelector<HTMLElement>(":scope > [data-payment-request-content-host]");
        for (const child of Array.from(shell.children)) {
          if (child instanceof HTMLElement && child !== host && child.tagName !== "HEADER") child.style.display = "";
        }
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
    {menuHost ? createPortal(
      <button
        onClick={navigate}
        className={`mb-4 mt-4 flex w-full items-center rounded-xl border px-4 py-2.5 text-left text-[12px] font-extrabold uppercase tracking-[0.16em] transition ${active ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-blue-400/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"}`}
      >
        {PAYMENT_LABEL}
      </button>,
      menuHost,
    ) : null}

    {contentHost && active ? createPortal(
      <section className="space-y-6 p-4 sm:p-6 xl:p-8"><PaymentRequestDashboard /></section>,
      contentHost,
    ) : null}
  </>;
}
