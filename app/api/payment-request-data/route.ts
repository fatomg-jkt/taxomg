import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const fileName = "payment-request-data.json";
const empty = { requests: [], updatedAt: null };

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

async function readRequests(storeId: string) {
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return empty;
    const payload = JSON.parse(await new Response(result.stream).text());
    return {
      requests: Array.isArray(payload.requests) ? payload.requests : [],
      updatedAt: payload.updatedAt ?? null,
    };
  } catch {
    return empty;
  }
}

export async function GET() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  const payload = await readRequests(storeId);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!password || request.headers.get("x-dashboard-password") !== password) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return NextResponse.json({ error: "Missing TAXOMG_STORE_ID" }, { status: 500 });

  const payload = await request.json().catch(() => ({}));
  const input = (payload.request ?? {}) as PaymentRequestInput;
  const required = [
    input.userName,
    input.department,
    input.code,
    input.invoiceDate,
    input.description,
    input.invoiceNumber,
    input.vendor,
    input.accountName,
    input.bank,
    input.accountNumber,
  ];
  if (required.some((value) => !String(value ?? "").trim()) || !Number.isFinite(Number(input.nominal)) || Number(input.nominal) <= 0) {
    return NextResponse.json({ error: "Semua field wajib diisi dengan benar." }, { status: 400 });
  }

  const current = await readRequests(storeId);
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
  const updatedAt = createdAt;
  const requests = [nextRequest, ...current.requests];

  await put(fileName, JSON.stringify({ requests, updatedAt }, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    storeId,
  });

  return NextResponse.json({ ok: true, request: nextRequest, requests, updatedAt }, { status: 201 });
}
