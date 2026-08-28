import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { readDashboardState, writeDashboardState } from "@/lib/supabase-dashboard-state";

const fileName = "control-omzet-data.json";
const stateKey = "control-omzet-data";
const emptyPayload = { controlOmzetData: [], updatedAt: null as string | null };
const headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readDashboardState(stateKey, emptyPayload), { headers });
  } catch (error) {
    console.error("[control-omzet-data] Supabase read failed", error);
    return NextResponse.json({ error: "Gagal membaca data control omzet dari Supabase." }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });

  const input = await request.json().catch(() => ({}));
  const payload = { controlOmzetData: Array.isArray(input.controlOmzetData) ? input.controlOmzetData : [], updatedAt: new Date().toISOString() };
  try {
    payload.updatedAt = await writeDashboardState(stateKey, payload);
  } catch (error) {
    console.error("[control-omzet-data] Supabase write failed", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data control omzet ke Supabase." }, { status: 500 });
  }

  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(fileName, JSON.stringify(payload, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId: process.env.TAXOMG_STORE_ID });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[control-omzet-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({ ok: true, updatedAt: payload.updatedAt, primaryStorage: "supabase", backupStorage: blobUrl ? "vercel-blob" : "unavailable", url: blobUrl });
}
