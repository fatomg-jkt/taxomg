import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "tax-dashboard-data.json";
const emptyPayload = { records: [], summaryOverrides: {}, updatedAt: null };

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.TAXOMG_READ_WRITE_TOKEN;
    if (!token) return NextResponse.json(emptyPayload, { headers: { "Cache-Control": "no-store" } });
    const blobs = await list({ prefix: fileName, token });
    const blob = blobs.blobs.find((item: { pathname: string; url: string }) => item.pathname === fileName) ?? blobs.blobs[0];
    if (!blob?.url) return NextResponse.json(emptyPayload, { headers: { "Cache-Control": "no-store" } });
    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) return NextResponse.json(emptyPayload, { headers: { "Cache-Control": "no-store" } });
    const payload = await response.json().catch(() => emptyPayload);
    return NextResponse.json({ ...emptyPayload, ...payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[tax-data] Failed to read blob", error);
    return NextResponse.json(emptyPayload, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
    const password = request.headers.get("x-dashboard-password");
    if (!expectedPassword || password !== expectedPassword) {
      return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
    }

    const token = process.env.TAXOMG_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing TAXOMG_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const updatedAt = new Date().toISOString();
    const blob = await put(fileName, JSON.stringify({ records: body.records ?? [], summaryOverrides: body.summaryOverrides ?? {}, updatedAt }, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.TAXOMG_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ ok: true, updatedAt, url: blob.url });
  } catch (error) {
    console.error("[tax-data] Failed to write blob", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Save to Cloud failed" }, { status: 500 });
  }
}
