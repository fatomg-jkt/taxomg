import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { readDashboardState, writeDashboardState } from "@/lib/supabase-dashboard-state";

const fileName = "cashflow-data.json";
const stateKey = "cashflow-data";
const empty = { cashflowData: { projection: [], actual: [], bankMutation: [], paymentRequests: [], lastUpdated: null as string | null }, updatedAt: null as string | null };
const headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readDashboardState(stateKey, empty), { headers });
  } catch (error) {
    console.error("[cashflow-data] Supabase read failed", error);
    return NextResponse.json({ error: "Gagal membaca data cashflow dari Supabase." }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const input = body.cashflowData ?? {};
  const now = new Date().toISOString();
  const payload = {
    cashflowData: {
      projection: Array.isArray(input.projection) ? input.projection : [],
      actual: Array.isArray(input.actual) ? input.actual : [],
      bankMutation: Array.isArray(input.bankMutation) ? input.bankMutation : [],
      paymentRequests: Array.isArray(input.paymentRequests) ? input.paymentRequests : [],
      lastUpdated: now,
    },
    updatedAt: now,
  };

  try {
    payload.updatedAt = await writeDashboardState(stateKey, payload);
    payload.cashflowData.lastUpdated = payload.updatedAt;
  } catch (error) {
    console.error("[cashflow-data] Supabase write failed", error);
    return NextResponse.json({ error: "Gagal menyimpan data cashflow ke Supabase." }, { status: 500 });
  }

  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(fileName, JSON.stringify(payload, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId: process.env.TAXOMG_STORE_ID });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[cashflow-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({ ok: true, updatedAt: payload.updatedAt, primaryStorage: "supabase", backupStorage: blobUrl ? "vercel-blob" : "unavailable", url: blobUrl });
}
