// The package supplies richer types in installed deployments. This small declaration keeps
// repository-only type checks useful in restricted environments where npm cannot download it.
declare module "@supabase/supabase-js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(url: string, key: string, options?: Record<string, unknown>): any;
}
