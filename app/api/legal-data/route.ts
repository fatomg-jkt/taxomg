import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { normalizeLegalData } from "@/lib/legal-data";
import { legalBlobOptions, legalDataPathname, readLegalData } from "./shared";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try { return NextResponse.json({ legalData: await readLegalData() }, { headers }); }
  catch (error) { console.error("[legal-data] Failed to read legal data", error); return NextResponse.json({ legalData: normalizeLegalData(null) }, { headers }); }
}

export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  if (!process.env.TAXOMG_STORE_ID) return NextResponse.json({ ok: false, error: "Missing TAXOMG_STORE_ID" }, { status: 500 });
  const payload = await request.json().catch(() => ({}));
  const legalData = { ...normalizeLegalData(payload.legalData), lastUpdated: new Date().toISOString() };
  const blob = await put(legalDataPathname, JSON.stringify({ legalData }, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, ...legalBlobOptions() });
  return NextResponse.json({ ok: true, legalData, updatedAt: legalData.lastUpdated, url: blob.url });
}
