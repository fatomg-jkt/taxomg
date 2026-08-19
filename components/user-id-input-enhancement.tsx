"use client";

import { useEffect } from "react";

export function UserIdInputEnhancement() {
  useEffect(() => {
    const apply = () => {
      for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="email"]'))) {
        input.type = "text";
        input.setAttribute("autocomplete", "username");
        if (input.id === "email") input.setAttribute("placeholder", "User ID");
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
