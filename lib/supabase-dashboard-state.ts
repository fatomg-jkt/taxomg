type DashboardStateRow<T> = {
  key: string;
  payload: T;
  updated_at: string;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url, key };
}

function supabaseHeaders(extra?: HeadersInit) {
  const { key } = getSupabaseConfig();
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "");
  return text || `${response.status} ${response.statusText}`;
}

export async function readDashboardState<T>(stateKey: string, emptyPayload: T): Promise<T> {
  const { url } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/dashboard_state?key=eq.${encodeURIComponent(stateKey)}&select=key,payload,updated_at&limit=1`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: supabaseHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed (${stateKey}): ${await readError(response)}`);
  }

  const rows = (await response.json()) as DashboardStateRow<T>[];
  if (!rows.length) return emptyPayload;
  return { ...(emptyPayload as object), ...(rows[0].payload as object) } as T;
}

export async function writeDashboardState<T extends object>(stateKey: string, payload: T) {
  const { url } = getSupabaseConfig();
  const updatedAt = new Date().toISOString();
  const endpoint = `${url}/rest/v1/dashboard_state?on_conflict=key`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation",
      Accept: "application/json",
    }),
    body: JSON.stringify([{ key: stateKey, payload, updated_at: updatedAt }]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed (${stateKey}): ${await readError(response)}`);
  }

  return updatedAt;
}
