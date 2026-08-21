/**
 * Client-side base-path helper for the portal-embedded instance.
 *
 * When this app is embedded in the MAB portal it is served under a base path
 * (e.g. "/apps/evaluation") on the portal's own origin. Next.js adds that base
 * to <Link>, router navigations and assets automatically — but NOT to `fetch`,
 * `EventSource`, or `window.location` assignments. Those use absolute "/api/…"
 * paths that would otherwise resolve against the portal origin (hitting the
 * portal's API, not ours). Prefix them explicitly.
 *
 * Empty in the standalone build (NEXT_PUBLIC_BASE_PATH unset), so this is a
 * no-op there and the standalone app is unchanged.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix an app-absolute path ("/api/…", "/login") with the base path. */
export function withBase(path: string): string {
  if (!BASE_PATH) return path;
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
