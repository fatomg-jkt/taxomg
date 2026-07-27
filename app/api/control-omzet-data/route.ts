import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "control-omzet-data.json";
const emptyPayload = { controlOmzetData: [], updatedAt: null };
const headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json(emptyPayload, { headers });
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return NextResponse.json(emptyPayload, { headers });
    const payload = JSON.parse(await new Response(result.stream).text());
    return NextResponse.json({ ...emptyPayload, ...payload }, { headers });
  } catch (error) { console.error("[control-omzet-data] Failed to read blob", error); return NextResponse.json(emptyPayload, { headers }); }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  const payload = await request.json().catch(() => ({})); const updatedAt = new Date().toISOString();
  const controlOmzetData = Array.isArray(payload.controlOmzetData) ? payload.controlOmzetData : [];
  const blob = await put(fileName, JSON.stringify({ controlOmzetData, updatedAt }, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId });
  return NextResponse.json({ ok: true, updatedAt, url: blob.url });
}
