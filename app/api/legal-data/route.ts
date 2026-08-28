import { NextResponse } from "next/server";
import { normalizeLegalData } from "@/lib/legal-data";
import { backupDashboardState, writeDashboardState } from "@/lib/dashboard-state";
import { legalDataPathname, readLegalData } from "./shared";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() { try { return NextResponse.json({ legalData: await readLegalData() }, { headers }); } catch (error) { console.error("[legal-data] Supabase read failed", error); return NextResponse.json({ error: "Gagal membaca data legal dari Supabase." }, { status: 500, headers }); } }
export async function POST(request: Request) { if (!process.env.DASHBOARD_EDIT_PASSWORD || request.headers.get("x-dashboard-password") !== process.env.DASHBOARD_EDIT_PASSWORD) return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 }); const body = await request.json().catch(() => ({})); const legalData = { ...normalizeLegalData(body.legalData), lastUpdated: new Date().toISOString() }; const payload = { legalData }; try { legalData.lastUpdated = await writeDashboardState("legal-data", payload); await backupDashboardState(legalDataPathname, payload); return NextResponse.json({ ok: true, legalData, updatedAt: legalData.lastUpdated }); } catch (error) { console.error("[legal-data] Supabase write failed", error); return NextResponse.json({ ok: false, error: "Gagal menyimpan data legal ke Supabase." }, { status: 500 }); } }
