import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "update-saldo-data.json";
const emptyPayload = { financeData: { accounts: [], deviceStatus: [], lastUpdated: null }, updatedAt: null };
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
    const text = await new Response(result.stream).text();
    if (!text.trim()) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
    const payload = JSON.parse(text);
    return NextResponse.json({ ...emptyPayload, ...payload }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[update-saldo-data] Failed to read blob", error);
    return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!expectedPassword || request.headers.get("x-dashboard-password") !== expectedPassword) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  if (!process.env.TAXOMG_STORE_ID) return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  const payload = await request.json().catch(() => ({}));
  const updatedAt = new Date().toISOString();
  const financeData = payload.financeData ?? { accounts: Array.isArray(payload.records) ? payload.records : [], deviceStatus: [], lastUpdated: updatedAt };
  const body = JSON.stringify({ financeData: { accounts: Array.isArray(financeData.accounts) ? financeData.accounts : [], deviceStatus: Array.isArray(financeData.deviceStatus) ? financeData.deviceStatus : [], lastUpdated: updatedAt }, updatedAt }, null, 2);
  const blob = await put(fileName, body, { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId: process.env.TAXOMG_STORE_ID });
  return NextResponse.json({ ok: true, updatedAt, url: blob.url });
}
