import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { readDashboardState, writeDashboardState } from "@/lib/supabase-dashboard-state";

const fileName = "payment-request-data.json";
const stateKey = "payment-request-data";
const empty = { requests: [], updatedAt: null as string | null };
const headers = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

type PaymentRequestInput = {
  id?: string;
  userName?: string;
  department?: string;
  code?: string;
  invoiceDate?: string;
  description?: string;
  invoiceNumber?: string;
  vendor?: string;
  nominal?: number;
  accountName?: string;
  bank?: string;
  accountNumber?: string;
  createdAt?: string;
};

export async function GET() {
  try {
    return NextResponse.json(await readDashboardState(stateKey, empty), { headers });
  } catch (error) {
    console.error("[payment-request-data] Supabase read failed", error);
    return NextResponse.json({ error: "Gagal membaca pengajuan pembayaran dari Supabase." }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const input = (body.request ?? {}) as PaymentRequestInput;
  const required = [input.userName, input.department, input.code, input.invoiceDate, input.description, input.invoiceNumber, input.vendor, input.accountName, input.bank, input.accountNumber];
  if (required.some((value) => !String(value ?? "").trim()) || !Number.isFinite(Number(input.nominal)) || Number(input.nominal) <= 0) {
    return NextResponse.json({ error: "Semua field wajib diisi dengan benar." }, { status: 400 });
  }

  let current = empty;
  try {
    current = await readDashboardState(stateKey, empty);
  } catch (error) {
    console.error("[payment-request-data] Supabase read before write failed", error);
    return NextResponse.json({ error: "Gagal membaca data pengajuan pembayaran sebelum menyimpan." }, { status: 500 });
  }

  const createdAt = new Date().toISOString();
  const nextRequest = {
    id: input.id || `payment-${crypto.randomUUID()}`,
    userName: String(input.userName).trim(),
    department: String(input.department).trim(),
    code: String(input.code).trim(),
    invoiceDate: String(input.invoiceDate).trim(),
    description: String(input.description).trim(),
    invoiceNumber: String(input.invoiceNumber).trim(),
    vendor: String(input.vendor).trim(),
    nominal: Number(input.nominal),
    accountName: String(input.accountName).trim(),
    bank: String(input.bank).trim(),
    accountNumber: String(input.accountNumber).trim(),
    createdAt,
  };

  const payload = { requests: [nextRequest, ...(Array.isArray(current.requests) ? current.requests : [])], updatedAt: createdAt };
  try {
    payload.updatedAt = await writeDashboardState(stateKey, payload);
  } catch (error) {
    console.error("[payment-request-data] Supabase write failed", error);
    return NextResponse.json({ error: "Gagal menyimpan pengajuan pembayaran ke Supabase." }, { status: 500 });
  }

  let blobUrl: string | undefined;
  try {
    if (process.env.TAXOMG_STORE_ID) {
      const blob = await put(fileName, JSON.stringify(payload, null, 2), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, storeId: process.env.TAXOMG_STORE_ID });
      blobUrl = blob.url;
    }
  } catch (error) {
    console.warn("[payment-request-data] Blob backup failed; Supabase data is already safe", error);
  }

  return NextResponse.json({ ok: true, request: nextRequest, requests: payload.requests, updatedAt: payload.updatedAt, primaryStorage: "supabase", backupStorage: blobUrl ? "vercel-blob" : "unavailable" }, { status: 201 });
}
