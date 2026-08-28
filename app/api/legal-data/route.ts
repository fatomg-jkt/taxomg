import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { normalizeLegalData } from "@/lib/legal-data";
import { writeDashboardState } from "@/lib/supabase-dashboard-state";
import { legalDataPathname, readLegalData } from "./shared";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json({ legalData: await readLegalData() }, { headers });
  } catch (error) {
    console.error("[legal-data] Supabase read failed", error);
    return NextResponse.json({ error: "Gagal membaca data legal dari Supabase." }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const input = await request.json().catch(() => ({}));
  const legalData = { ...normalizeLegalData(input.legalData), lastUpdated: new Date().toISOString() };
  const payload = { legalData };

  try {
    legalData.lastUpdated = await writeDashboardState("legal-data", payload);
  } catch (error) {
    console.error("[legal-data] Supabase write failed", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data legal ke Supabase." }, { status: 500 });
  }

  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(legalDataPathname, JSON.stringify({ legalData }, null, 2), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        storeId: process.env.TAXOMG_STORE_ID,
      });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[legal-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({ ok: true, legalData, updatedAt: legalData.lastUpdated, primaryStorage: "supabase", backupStorage: blobUrl ? "vercel-blob" : "unavailable", url: blobUrl });
}
