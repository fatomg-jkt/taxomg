type GraphDriveItem = {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  folder?: Record<string, unknown>;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ROOT_FOLDER = "OMG Dashboard";

export function isOneDriveConfigured() {
  return Boolean(
    process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_CLIENT_SECRET &&
    process.env.ONEDRIVE_DRIVE_ID,
  );
}

export function oneDriveRootFolder() {
  return sanitizePath(process.env.ONEDRIVE_ROOT_FOLDER || DEFAULT_ROOT_FOLDER);
}

export function oneDrivePathname(itemId: string) {
  return `onedrive:${itemId}`;
}

export function oneDriveItemId(pathname: string) {
  return pathname.startsWith("onedrive:") ? pathname.slice("onedrive:".length) : null;
}

function sanitizeSegment(value: string) {
  return value
    .replace(/["*:<>?\\|]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180) || "file";
}

export function sanitizeOneDriveFileName(name: string) {
  return sanitizeSegment(name.replace(/[\/]/g, "_"));
}

export function sanitizePath(path: string) {
  return path
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join("/");
}

async function accessToken() {
  if (!isOneDriveConfigured()) throw new Error("OneDrive belum dikonfigurasi di Vercel Environment Variables.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const tenant = process.env.MS_GRAPH_TENANT_ID!;
  const body = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID!,
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Gagal mendapatkan Microsoft Graph access token.");
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max((payload.expires_in || 3600) - 120, 60) * 1000,
  };
  return tokenCache.token;
}

async function graph(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

async function parseGraphError(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return payload.error?.message || `${response.status} ${response.statusText}`;
}

async function getRootItem() {
  const driveId = process.env.ONEDRIVE_DRIVE_ID!;
  const response = await graph(`/drives/${encodeURIComponent(driveId)}/root`);
  if (!response.ok) throw new Error(`Gagal membaca root OneDrive: ${await parseGraphError(response)}`);
  return response.json() as Promise<GraphDriveItem>;
}

async function findChild(parentId: string, name: string) {
  const driveId = process.env.ONEDRIVE_DRIVE_ID!;
  const base = parentId === "root"
    ? `/drives/${encodeURIComponent(driveId)}/root/children`
    : `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children`;
  const response = await graph(`${base}?$select=id,name,folder&$top=200`);
  if (!response.ok) return null;
  const payload = await response.json() as { value?: GraphDriveItem[] };
  return payload.value?.find((item) => item.name === name && item.folder) || null;
}

async function createFolder(parentId: string, name: string) {
  const driveId = process.env.ONEDRIVE_DRIVE_ID!;
  const path = parentId === "root"
    ? `/drives/${encodeURIComponent(driveId)}/root/children`
    : `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children`;
  const response = await graph(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  });
  if (response.status === 409) {
    const existing = await findChild(parentId, name);
    if (existing) return existing;
  }
  if (!response.ok) throw new Error(`Gagal membuat folder OneDrive ${name}: ${await parseGraphError(response)}`);
  return response.json() as Promise<GraphDriveItem>;
}

export async function ensureOneDriveFolder(relativeFolder: string) {
  if (!isOneDriveConfigured()) throw new Error("OneDrive belum dikonfigurasi.");
  const root = await getRootItem();
  let parentId = root.id || "root";
  const fullPath = sanitizePath([oneDriveRootFolder(), relativeFolder].filter(Boolean).join("/"));

  for (const segment of fullPath.split("/").filter(Boolean)) {
    const existing = await findChild(parentId, segment);
    const folder = existing || await createFolder(parentId, segment);
    parentId = folder.id;
  }
  return parentId;
}

export async function uploadFileToOneDrive(file: File, relativeFolder: string) {
  const parentId = await ensureOneDriveFolder(relativeFolder);
  const driveId = process.env.ONEDRIVE_DRIVE_ID!;
  const fileName = sanitizeOneDriveFileName(file.name);
  const encodedName = encodeURIComponent(fileName);
  const response = await graph(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}:/${encodedName}:/content`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!response.ok) throw new Error(`Gagal upload ${fileName} ke OneDrive: ${await parseGraphError(response)}`);
  return response.json() as Promise<GraphDriveItem>;
}

export async function downloadFileFromOneDrive(itemId: string) {
  if (!isOneDriveConfigured()) throw new Error("OneDrive belum dikonfigurasi.");
  const driveId = process.env.ONEDRIVE_DRIVE_ID!;
  const response = await graph(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`, {
    redirect: "follow",
  });
  if (!response.ok || !response.body) throw new Error(`Gagal membaca file OneDrive: ${await parseGraphError(response)}`);
  return response;
}
