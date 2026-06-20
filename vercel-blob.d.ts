declare module "@vercel/blob" {
  export function list(options?: { prefix?: string; token?: string }): Promise<{ blobs: Array<{ pathname: string; url: string }> }>;
  export function put(pathname: string, body: string | Blob | ArrayBuffer | ReadableStream, options: { access: "public"; contentType?: string; addRandomSuffix?: boolean; token?: string }): Promise<{ url: string }>;
}
