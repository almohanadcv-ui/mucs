/**
 * Validates a post-login return path.
 *
 * The value arrives in a query string a user can edit, so it is treated as
 * untrusted: only a same-site absolute path is allowed. Rejecting anything
 * else is what stops `?next=https://evil.example` from turning our login page
 * into a redirector that lends this domain's credibility to someone else's.
 *
 * `//host` is rejected too — browsers read it as protocol-relative and would
 * leave the site despite the leading slash.
 */
export function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
