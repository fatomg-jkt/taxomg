import { NextResponse } from "next/server";

const BLOB_NAME = "tax-dashboard-data.json";
const DEFAULT_DATA = { records: [], updatedAt: null };

type TaxDataPayload = {
  records?: unknown[];
  updatedAt?: string | null;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storeId = process.env.TAXOMG_STORE_ID;
    const blobUrl = storeId ? `https://${storeId}.public.blob.vercel-storage.com/${BLOB_NAME}` : null;

    if (!blobUrl) return NextResponse.json(DEFAULT_DATA);

    const response = await fetch(blobUrl, { cache: "no-store" });
    if (!response.ok) return NextResponse.json(DEFAULT_DATA);

    const payload = (await response.json()) as TaxDataPayload;
    return NextResponse.json({
      records: Array.isArray(payload.records) ? payload.records : [],
      updatedAt: payload.updatedAt ?? null,
    });
  } catch (error) {
    console.error("[tax-data] Blob read failed", error);
    return NextResponse.json(DEFAULT_DATA);
  }
}

export async function POST(request: Request) {
  try {
    const token = process.env.TAXOMG_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing TAXOMG_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const body = (await request.json()) as TaxDataPayload;
    const updatedAt = new Date().toISOString();
    const payload = {
      records: Array.isArray(body.records) ? body.records : [],
      updatedAt,
    };

    const { put } = eval("require")("@vercel/blob") as typeof import("@vercel/blob");
    const blob = await put(BLOB_NAME, JSON.stringify(payload, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      token,
    });

    return NextResponse.json({ ok: true, url: blob.url, updatedAt });
  } catch (error) {
    console.error("[tax-data] Blob write failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan data" }, { status: 500 });
  }
}
