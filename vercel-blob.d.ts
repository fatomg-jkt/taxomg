declare module "@vercel/blob" {
  type BlobAccess = "private" | "public";

  export function get(
    urlOrPathname: string,
    options: { access: BlobAccess; token?: string; storeId?: string },
  ): Promise<{
    statusCode: number;
    stream: ReadableStream<Uint8Array> | null;
    blob: { url: string; downloadUrl: string; pathname: string; contentType: string | null };
  } | null>;

  export function list(options?: { prefix?: string; token?: string; storeId?: string }): Promise<{ blobs: Array<{ pathname: string; url: string }> }>;
  export function put(pathname: string, body: string | Blob | ArrayBuffer | ReadableStream, options: { access: BlobAccess; contentType?: string; addRandomSuffix?: boolean; allowOverwrite?: boolean; token?: string; storeId?: string }): Promise<{ url: string }>;
}
