"use client";

import { useEffect } from "react";

const LEGACY_SUFFIX = "@company.com";

function stripLegacySuffix(value: string) {
  const trimmed = value.trim();
  return trimmed.toLowerCase().endsWith(LEGACY_SUFFIX)
    ? trimmed.slice(0, -LEGACY_SUFFIX.length)
    : value;
}

export function LoginCopyEnhancement() {
  useEffect(() => {
    let syncing = false;

    const normalizeInputValue = (input: HTMLInputElement) => {
      const normalized = stripLegacySuffix(input.value);
      if (normalized === input.value) return;

      syncing = true;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, normalized);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      syncing = false;
    };

    const apply = () => {
      const userInput = document.querySelector<HTMLInputElement>("input#email");
      if (!userInput) return;

      // Login sekarang memakai username biasa, bukan alamat email.
      userInput.type = "text";
      userInput.name = "username";
      userInput.autocomplete = "username";
      userInput.inputMode = "text";
      userInput.placeholder = "owner";
      normalizeInputValue(userInput);

      const loginCard = userInput.closest("section");
      if (!loginCard) return;

      for (const paragraph of Array.from(loginCard.querySelectorAll("p"))) {
        if (paragraph.textContent?.trim() === "Gunakan email yang telah didaftarkan oleh administrator.") {
          paragraph.textContent = "Gunakan user yang telah didaftarkan oleh administrator.";
        } else if (paragraph.textContent?.trim() === "Email wajib diisi.") {
          paragraph.textContent = "User ID wajib diisi.";
        } else if (paragraph.textContent?.trim() === "Email tidak memiliki akses.") {
          paragraph.textContent = "User ID tidak memiliki akses.";
        }
      }
    };

    const onUserInput = (event: Event) => {
      if (syncing) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "email") return;
      normalizeInputValue(target);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", onUserInput, true);
    document.addEventListener("change", onUserInput, true);
    document.addEventListener("focusin", onUserInput, true);

    // Browser password manager dapat mengisi credential sesaat setelah mount.
    // Cek singkat saat login pertama tampil agar owner@company.com berubah menjadi owner.
    let checks = 0;
    const autofillTimer = window.setInterval(() => {
      apply();
      checks += 1;
      if (checks >= 12) window.clearInterval(autofillTimer);
    }, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(autofillTimer);
      document.removeEventListener("input", onUserInput, true);
      document.removeEventListener("change", onUserInput, true);
      document.removeEventListener("focusin", onUserInput, true);
    };
  }, []);

  return null;
}
