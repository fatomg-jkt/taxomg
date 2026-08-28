import { NextResponse } from "next/server";
import { backupDashboardState, readDashboardState, writeDashboardState } from "@/lib/dashboard-state";

const key = "cashflow-data", fileName = "cashflow-data.json";
const empty = { cashflowData: { projection: [], actual: [], bankMutation: [], lastUpdated: null as string | null }, updatedAt: null as string | null };
const headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";
export async function GET() { try { return NextResponse.json(await readDashboardState(key, empty), { headers }); } catch (error) { console.error("[cashflow-data] Supabase read failed", error); return NextResponse.json({ error: "Gagal membaca data cashflow dari Supabase." }, { status: 500, headers }); } }
export async function POST(request: Request) {
  if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const body = await request.json().catch(() => ({})); const input = body.cashflowData ?? {}; const now = new Date().toISOString();
  const payload = { cashflowData: { projection: Array.isArray(input.projection) ? input.projection : [], actual: Array.isArray(input.actual) ? input.actual : [], bankMutation: Array.isArray(input.bankMutation) ? input.bankMutation : [], lastUpdated: now }, updatedAt: now };
  try { payload.updatedAt = await writeDashboardState(key, payload); payload.cashflowData.lastUpdated = payload.updatedAt; const blob = await backupDashboardState(fileName, payload); return NextResponse.json({ ok: true, updatedAt: payload.updatedAt, url: blob?.url }); }
  catch (error) { console.error("[cashflow-data] Supabase write failed", error); return NextResponse.json({ error: "Gagal menyimpan data cashflow ke Supabase." }, { status: 500 }); }
}
