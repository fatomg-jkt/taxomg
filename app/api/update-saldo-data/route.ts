import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase-server";

const fileName = "update-saldo-data.json";
const STATE_ID = "finance-dashboard";
const emptyPayload = { financeData: { accounts: [], deviceStatus: [], lastUpdated: null }, updatedAt: null };
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

type FinanceStateRow = {
  id: string;
  finance_data: {
    accounts?: unknown[];
    deviceStatus?: unknown[];
    lastUpdated?: string | null;
  } | null;
  updated_at: string | null;
};

function normalizeFinanceData(value: unknown, updatedAt: string | null = null) {
  const financeData = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    accounts: Array.isArray(financeData.accounts) ? financeData.accounts : [],
    deviceStatus: Array.isArray(financeData.deviceStatus) ? financeData.deviceStatus : [],
    lastUpdated: typeof financeData.lastUpdated === "string" ? financeData.lastUpdated : updatedAt,
  };
}

async function loadFromSupabase() {
  const rows = await supabaseRequest<FinanceStateRow[]>(`/rest/v1/finance_dashboard_state?id=eq.${encodeURIComponent(STATE_ID)}&select=id,finance_data,updated_at&limit=1`);
  const row = rows[0];
  if (!row) return null;
  const updatedAt = row.updated_at ?? null;
  return { financeData: normalizeFinanceData(row.finance_data, updatedAt), updatedAt };
}

async function saveToSupabase(financeData: unknown, updatedAt: string) {
  const normalized = normalizeFinanceData(financeData, updatedAt);
  normalized.lastUpdated = updatedAt;
  await supabaseRequest(`/rest/v1/finance_dashboard_state?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: STATE_ID, finance_data: normalized, updated_at: updatedAt }]),
  });
  return normalized;
}

async function tryLegacyBlob() {
  const storeId = process.env.TAXOMG_STORE_ID;
  if (!storeId) return null;
  try {
    const result = await get(fileName, { access: "private", storeId });
    if (result?.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    if (!text.trim()) return null;
    const payload = JSON.parse(text) as { financeData?: unknown; updatedAt?: string | null };
    const updatedAt = payload.updatedAt ?? new Date().toISOString();
    const financeData = normalizeFinanceData(payload.financeData, updatedAt);
    return { financeData, updatedAt };
  } catch (error) {
    console.error("[update-saldo-data] Legacy Blob read failed", error);
    return null;
  }
}

export async function GET() {
  try {
    const current = await loadFromSupabase();
    if (current) return NextResponse.json(current, { headers: noStoreHeaders });

    const legacy = await tryLegacyBlob();
    if (legacy) {
      try {
        const migrated = await saveToSupabase(legacy.financeData, legacy.updatedAt);
        return NextResponse.json({ financeData: migrated, updatedAt: legacy.updatedAt, migratedFrom: "vercel-blob" }, { headers: noStoreHeaders });
      } catch (migrationError) {
        console.error("[update-saldo-data] Legacy data found but Supabase migration failed", migrationError);
        return NextResponse.json(legacy, { headers: noStoreHeaders });
      }
    }

    return NextResponse.json(emptyPayload, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[update-saldo-data] Supabase read failed", error);
    return NextResponse.json({ ...emptyPayload, error: error instanceof Error ? error.message : "Database gagal dibaca" }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_EDIT_PASSWORD;
  if (!expectedPassword || request.headers.get("x-dashboard-password") !== expectedPassword) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const updatedAt = new Date().toISOString();
    const sourceFinanceData = payload.financeData ?? {
      accounts: Array.isArray(payload.records) ? payload.records : [],
      deviceStatus: [],
      lastUpdated: updatedAt,
    };
    const financeData = await saveToSupabase(sourceFinanceData, updatedAt);
    return NextResponse.json({ ok: true, updatedAt, financeData, storage: "supabase" });
  } catch (error) {
    console.error("[update-saldo-data] Supabase write failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Data Finance gagal disimpan ke Supabase" }, { status: 500 });
  }
}
