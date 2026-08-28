import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { readDashboardState, writeDashboardState } from "@/lib/supabase-dashboard-state";

const fileName = "update-saldo-data.json";
const stateKey = "update-saldo-data";
const emptyPayload = { financeData: { accounts: [], deviceStatus: [], lastUpdated: null as string | null }, updatedAt: null as string | null };
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readDashboardState(stateKey, emptyPayload), { headers: noStoreHeaders });
  } catch (error) {
    console.error("[update-saldo-data] Supabase read failed", error);
    return NextResponse.json({ ok: false, error: "Gagal membaca data saldo dari Supabase." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!expectedPassword || request.headers.get("x-dashboard-password") !== expectedPassword) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });

  const input = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const financeDataInput = input.financeData ?? { accounts: Array.isArray(input.records) ? input.records : [], deviceStatus: [] };
  const payload = {
    financeData: {
      accounts: Array.isArray(financeDataInput.accounts) ? financeDataInput.accounts : [],
      deviceStatus: Array.isArray(financeDataInput.deviceStatus) ? financeDataInput.deviceStatus : [],
      lastUpdated: now,
    },
    updatedAt: now,
  };

  try {
    payload.updatedAt = await writeDashboardState(stateKey, payload);
    payload.financeData.lastUpdated = payload.updatedAt;
  } catch (error) {
    console.error("[update-saldo-data] Supabase write failed", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data saldo ke Supabase." }, { status: 500 });
  }

  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(fileName, JSON.stringify(payload, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId: process.env.TAXOMG_STORE_ID });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[update-saldo-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({ ok: true, updatedAt: payload.updatedAt, primaryStorage: "supabase", backupStorage: blobUrl ? "vercel-blob" : "unavailable", url: blobUrl });
}
