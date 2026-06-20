import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "tax-dashboard-data.json";
const emptyPayload = { records: [], summaryOverrides: {}, updatedAt: null };
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });

  try {
    const blobs = await list({ prefix: fileName, storeId });
    const blob = blobs.blobs.find((item: { pathname: string; url: string }) => item.pathname === fileName) ?? blobs.blobs[0];
    if (!blob?.url) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });

    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });

    const text = await response.text();
    if (!text.trim()) return NextResponse.json(emptyPayload, { headers: noStoreHeaders });

    const payload = JSON.parse(text);
    return NextResponse.json({ ...emptyPayload, ...payload }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[tax-data] Failed to read blob", error);
    return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!expectedPassword || request.headers.get("x-dashboard-password") !== expectedPassword) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  if (!process.env.TAXOMG_STORE_ID) {
    return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  }

  const payload = await request.json().catch(() => ({}));
  const updatedAt = new Date().toISOString();
  const body = JSON.stringify({ records: payload.records ?? [], summaryOverrides: payload.summaryOverrides ?? {}, updatedAt }, null, 2);
  const blob = await put(fileName, body, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    storeId: process.env.TAXOMG_STORE_ID,
  });
  return NextResponse.json({ ok: true, updatedAt, url: blob.url });
}
