import "server-only";

import { put } from "@vercel/blob";
import { getSupabaseServerClient } from "./supabase-server";

export async function readDashboardState<T>(key: string, emptyPayload: T): Promise<T> {
  const { data, error } = await getSupabaseServerClient()
    .from("dashboard_state")
    .select("payload")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Supabase gagal membaca dashboard_state (${key}): ${error.message}`);
  return data ? ({ ...emptyPayload, ...(data.payload as object) } as T) : emptyPayload;
}

export async function writeDashboardState(key: string, payload: object) {
  const updatedAt = new Date().toISOString();
  const { error } = await getSupabaseServerClient().from("dashboard_state").upsert({ key, payload, updated_at: updatedAt });
  if (error) throw new Error(`Supabase gagal menyimpan dashboard_state (${key}): ${error.message}`);
  return updatedAt;
}

export async function backupDashboardState(pathname: string, payload: object) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.TAXOMG_STORE_ID) return undefined;
    return await put(pathname, JSON.stringify(payload, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(process.env.BLOB_READ_WRITE_TOKEN
        ? { token: process.env.BLOB_READ_WRITE_TOKEN }
        : { storeId: process.env.TAXOMG_STORE_ID }),
    });
  } catch (error) {
    console.warn(`[dashboard-state] Vercel Blob backup gagal (${pathname}); data utama sudah tersimpan di Supabase.`, error);
    return undefined;
  }
}
