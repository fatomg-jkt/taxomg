import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { readDashboardState, writeDashboardState } from "@/lib/supabase-dashboard-state";

const fileName = "tax-dashboard-data.json";
const stateKey = "tax-data";
const emptyPayload = { records: [], summaryOverrides: {}, updatedAt: null as string | null };
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await readDashboardState(stateKey, emptyPayload);
    return NextResponse.json(payload, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[tax-data] Supabase read failed", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membaca data pajak dari Supabase." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!expectedPassword || request.headers.get("x-dashboard-password") !== expectedPassword) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const input = await request.json().catch(() => ({}));
  const payload = {
    records: Array.isArray(input.records) ? input.records : [],
    summaryOverrides: input.summaryOverrides ?? {},
    updatedAt: new Date().toISOString(),
  };

  try {
    payload.updatedAt = await writeDashboardState(stateKey, payload);
  } catch (error) {
    console.error("[tax-data] Supabase write failed", error);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan data pajak ke Supabase." },
      { status: 500 },
    );
  }

  // Blob hanya backup sekunder. Kegagalan Blob tidak boleh menggagalkan penyimpanan Supabase.
  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(fileName, JSON.stringify(payload, null, 2), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        storeId: process.env.TAXOMG_STORE_ID,
      });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[tax-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({
    ok: true,
    updatedAt: payload.updatedAt,
    primaryStorage: "supabase",
    backupStorage: blobUrl ? "vercel-blob" : "unavailable",
    url: blobUrl,
  });
}
