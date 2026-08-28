import { NextResponse } from "next/server";
import { backupDashboardState, readDashboardState, writeDashboardState } from "@/lib/dashboard-state";

const key = "payment-request-data", fileName = "payment-request-data.json", empty = { requests: [] as Record<string, unknown>[], updatedAt: null as string | null };
export const dynamic = "force-dynamic";
type PaymentRequestInput = { id?: string; userName?: string; department?: string; code?: string; invoiceDate?: string; description?: string; invoiceNumber?: string; vendor?: string; nominal?: number; accountName?: string; bank?: string; accountNumber?: string; createdAt?: string };
export async function GET() { try { return NextResponse.json(await readDashboardState(key, empty), { headers: { "Cache-Control": "no-store" } }); } catch (error) { console.error("[payment-request-data] Supabase read failed", error); return NextResponse.json({ error: "Gagal membaca payment request dari Supabase." }, { status: 500, headers: { "Cache-Control": "no-store" } }); } }
export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const body = await request.json().catch(() => ({})); const input = (body.request ?? {}) as PaymentRequestInput;
  const required = [input.userName, input.department, input.code, input.invoiceDate, input.description, input.invoiceNumber, input.vendor, input.accountName, input.bank, input.accountNumber];
  if (required.some((value) => !String(value ?? "").trim()) || !Number.isFinite(Number(input.nominal)) || Number(input.nominal) <= 0) return NextResponse.json({ error: "Semua field wajib diisi dengan benar." }, { status: 400 });
  try {
    const current = await readDashboardState(key, empty); const createdAt = new Date().toISOString();
    const nextRequest = { id: input.id || `payment-${crypto.randomUUID()}`, userName: String(input.userName).trim(), department: String(input.department).trim(), code: String(input.code).trim(), invoiceDate: String(input.invoiceDate).trim(), description: String(input.description).trim(), invoiceNumber: String(input.invoiceNumber).trim(), vendor: String(input.vendor).trim(), nominal: Number(input.nominal), accountName: String(input.accountName).trim(), bank: String(input.bank).trim(), accountNumber: String(input.accountNumber).trim(), createdAt };
    const payload = { requests: [nextRequest, ...current.requests], updatedAt: createdAt }; payload.updatedAt = await writeDashboardState(key, payload); await backupDashboardState(fileName, payload);
    return NextResponse.json({ ok: true, request: nextRequest, requests: payload.requests, updatedAt: payload.updatedAt }, { status: 201 });
  } catch (error) { console.error("[payment-request-data] Supabase operation failed", error); return NextResponse.json({ error: "Gagal menyimpan payment request ke Supabase." }, { status: 500 }); }
}
