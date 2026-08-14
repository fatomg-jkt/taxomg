"use client";

import { useEffect } from "react";

export function LoginCopyEnhancement() {
  useEffect(() => {
    const apply = () => {
      const emailInput = document.querySelector<HTMLInputElement>('input#email');
      if (!emailInput) return;

      emailInput.placeholder = "user";

      const loginCard = emailInput.closest("section");
      if (!loginCard) return;

      for (const paragraph of Array.from(loginCard.querySelectorAll("p"))) {
        if (paragraph.textContent?.trim() === "Gunakan email yang telah didaftarkan oleh administrator.") {
          paragraph.textContent = "Gunakan user yang telah didaftarkan oleh administrator.";
        } else if (paragraph.textContent?.trim() === "Email wajib diisi.") {
          paragraph.textContent = "User wajib diisi.";
        } else if (paragraph.textContent?.trim() === "Email tidak memiliki akses.") {
          paragraph.textContent = "User tidak memiliki akses.";
        }
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
