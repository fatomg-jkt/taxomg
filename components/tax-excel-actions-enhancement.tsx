"use client";

import { useEffect } from "react";
import * as XLSX from "xlsx";

type TaxTemplatePage = "ppn" | "pph21" | "unifikasi" | "pb1" | "umkm";

type TemplateSpec = {
  fileName: string;
  title: string;
  headers: string[];
  notes: string[];
};

const TEMPLATE_SPECS: Record<TaxTemplatePage, TemplateSpec> = {
  ppn: {
    fileName: "Template_Upload_PPN.xlsx",
    title: "PPN",
    headers: [
      "Perusahaan",
      "Masa Pajak",
      "Tahun",
      "PPN Keluaran",
      "PPN Masukan",
      "PM Tidak Dikreditkan",
      "Pajak Terutang",
      "Total Pembayaran PPN",
      "NTPN/NTPD",
      "Status",
    ],
    notes: [
      "Pajak Terutang boleh dikosongkan; aplikasi akan menghitung PPN Keluaran - PPN Masukan.",
      "Total Pembayaran PPN diisi dengan nominal pembayaran aktual.",
    ],
  },
  pph21: {
    fileName: "Template_Upload_PPh21.xlsx",
    title: "PPh Pasal 21",
    headers: ["Perusahaan", "Masa Pajak", "Tahun", "DPP", "Pajak Terutang", "NTPN/NTPD", "Status"],
    notes: ["Gunakan satu baris untuk setiap perusahaan dan masa pajak."],
  },
  unifikasi: {
    fileName: "Template_Upload_PPh_Unifikasi.xlsx",
    title: "PPh Unifikasi",
    headers: ["Perusahaan", "Masa Pajak", "Tahun", "Jenis Pajak", "DPP", "Pajak Terutang", "NTPN/NTPD", "Status"],
    notes: ["Kolom Jenis Pajak diisi PPh Pasal 23 atau PPh Final 4(2)."],
  },
  pb1: {
    fileName: "Template_Upload_PB1.xlsx",
    title: "PB1",
    headers: ["Perusahaan", "Masa Pajak", "Tahun", "DPP", "Pajak Terutang", "NTPN/NTPD", "Status"],
    notes: ["NTPN/NTPD dapat diisi dengan NTPD untuk PB1."],
  },
  umkm: {
    fileName: "Template_Upload_PPh_UMKM.xlsx",
    title: "PPh UMKM",
    headers: ["Perusahaan", "Masa Pajak", "Tahun", "DPP", "Pajak Terutang", "NTPN/NTPD", "Status"],
    notes: ["Isi Pajak Terutang dengan nominal PPh UMKM untuk masa pajak tersebut."],
  },
};

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function currentTaxPage(): TaxTemplatePage | null {
  const pageParam = new URLSearchParams(window.location.search).get("page");
  if (pageParam === "ppn" || pageParam === "pph21" || pageParam === "unifikasi" || pageParam === "pb1" || pageParam === "umkm") {
    return pageParam;
  }

  const title = normalizeText(document.querySelector("main h1")?.textContent);
  if (title === "PPN") return "ppn";
  if (title === "PPH PASAL 21") return "pph21";
  if (title === "PPH UNIFIKASI") return "unifikasi";
  if (title === "PB1") return "pb1";
  if (title === "PPH UMKM") return "umkm";
  return null;
}

function downloadTemplate(page: TaxTemplatePage) {
  const spec = TEMPLATE_SPECS[page];
  const workbook = XLSX.utils.book_new();

  const uploadSheet = XLSX.utils.aoa_to_sheet([spec.headers]);
  uploadSheet["!cols"] = spec.headers.map((header) => ({ wch: Math.max(16, Math.min(28, header.length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, uploadSheet, "UPLOAD");

  const guideRows = [
    [`Template Upload ${spec.title}`],
    [],
    ["Petunjuk"],
    ["1. Isi data hanya pada sheet UPLOAD."],
    ["2. Jangan mengubah nama header pada baris pertama."],
    ["3. Masa Pajak gunakan nama bulan, misalnya Januari, Februari, dan seterusnya."],
    ["4. Tahun gunakan 4 digit, misalnya 2026."],
    ["5. Status boleh dikosongkan. Jika kosong, aplikasi menentukan status dari NTPN/NTPD."],
    ...spec.notes.map((note, index) => [`${index + 6}. ${note}`]),
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [{ wch: 96 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, "PETUNJUK");

  XLSX.writeFile(workbook, spec.fileName, { compression: true });
}

function isManualCreateButton(button: HTMLButtonElement) {
  const label = normalizeText(button.textContent);
  return label === "MANUAL" || label === "+ MANUAL" || label.includes("TAMBAH DATA MANUAL") || label.startsWith("+ TAMBAH DATA PPN") || label.startsWith("+ TAMBAH DATA PPH") || label.startsWith("+ TAMBAH DATA PB");
}

function makeMenu(nativeUpload: HTMLButtonElement, page: TaxTemplatePage) {
  const spec = TEMPLATE_SPECS[page];
  const wrapper = document.createElement("div");
  wrapper.dataset.taxExcelActions = "true";
  wrapper.dataset.taxExcelPage = page;
  wrapper.className = "relative flex-1 sm:flex-none";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.dataset.taxExcelGenerated = "true";
  trigger.className = nativeUpload.className;
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.textContent = "Upload Excel  ▾";

  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.className = "absolute right-0 z-50 mt-2 hidden min-w-[250px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl";

  const uploadItem = document.createElement("button");
  uploadItem.type = "button";
  uploadItem.dataset.taxExcelGenerated = "true";
  uploadItem.setAttribute("role", "menuitem");
  uploadItem.className = "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-100";
  uploadItem.textContent = `Upload Excel ${spec.title}`;

  const downloadItem = document.createElement("button");
  downloadItem.type = "button";
  downloadItem.dataset.taxExcelGenerated = "true";
  downloadItem.setAttribute("role", "menuitem");
  downloadItem.className = "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-100";
  downloadItem.textContent = `Download Template ${spec.title}`;

  const setOpen = (open: boolean) => {
    trigger.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("hidden", !open);
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(trigger.getAttribute("aria-expanded") !== "true");
  });

  uploadItem.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    nativeUpload.click();
  });

  downloadItem.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    downloadTemplate(page);
  });

  menu.append(uploadItem, downloadItem);
  wrapper.append(trigger, menu);
  nativeUpload.insertAdjacentElement("afterend", wrapper);
}

export function TaxExcelActionsEnhancement() {
  useEffect(() => {
    let frame = 0;
    let applying = false;

    const restore = () => {
      for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-tax-native-upload='true']"))) {
        button.style.removeProperty("display");
        delete button.dataset.taxNativeUpload;
      }
      for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-tax-manual-hidden='true']"))) {
        button.style.removeProperty("display");
        delete button.dataset.taxManualHidden;
      }
      for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>("[data-tax-excel-actions='true']"))) wrapper.remove();
    };

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        const page = currentTaxPage();
        if (!page) {
          restore();
          return;
        }

        const existingWrapper = document.querySelector<HTMLElement>("[data-tax-excel-actions='true']");
        if (existingWrapper && existingWrapper.dataset.taxExcelPage !== page) {
          restore();
        }

        for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("main button"))) {
          if (button.dataset.taxExcelGenerated === "true" || button.closest("[data-tax-excel-actions='true']")) continue;
          if (isManualCreateButton(button)) {
            button.dataset.taxManualHidden = "true";
            button.style.setProperty("display", "none", "important");
          }
        }

        for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("main button"))) {
          if (button.dataset.taxExcelGenerated === "true" || button.closest("[data-tax-excel-actions='true']")) continue;
          if (normalizeText(button.textContent) !== "UPLOAD EXCEL") continue;
          if (button.dataset.taxNativeUpload === "true") continue;
          button.dataset.taxNativeUpload = "true";
          button.style.setProperty("display", "none", "important");
          makeMenu(button, page);
        }
      } finally {
        applying = false;
      }
    };

    const scheduleApply = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };

    const closeMenus = (event: MouseEvent) => {
      const target = event.target;
      for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>("[data-tax-excel-actions='true']"))) {
        if (target instanceof Node && wrapper.contains(target)) continue;
        wrapper.querySelector<HTMLElement>("[role='menu']")?.classList.add("hidden");
        wrapper.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")?.setAttribute("aria-expanded", "false");
      }
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", closeMenus, true);
    window.addEventListener("popstate", scheduleApply);
    scheduleApply();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("click", closeMenus, true);
      window.removeEventListener("popstate", scheduleApply);
      restore();
    };
  }, []);

  return null;
}
