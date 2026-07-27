import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "cashflow-data.json";
const empty = { cashflowData: { projection: [], actual: [], bankMutation: [], lastUpdated: null }, updatedAt: null };
export const dynamic = "force-dynamic";

export async function GET() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return NextResponse.json(empty);
    const payload = JSON.parse(await new Response(result.stream).text());
    return NextResponse.json({ ...empty, ...payload }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } }); }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json({ error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  const payload = await request.json().catch(() => ({}));
  const input = payload.cashflowData ?? {};
  const updatedAt = new Date().toISOString();
  const cashflowData = { projection: Array.isArray(input.projection) ? input.projection : [], actual: Array.isArray(input.actual) ? input.actual : [], bankMutation: Array.isArray(input.bankMutation) ? input.bankMutation : [], lastUpdated: updatedAt };
  const blob = await put(fileName, JSON.stringify({ cashflowData, updatedAt }, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId });
  return NextResponse.json({ ok: true, updatedAt, url: blob.url });
}
