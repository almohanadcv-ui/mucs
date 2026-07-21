/**
 * Escapes text before it is interpolated into an email body.
 *
 * Notification text is not trusted input: a rejection reason and a workshop
 * name are typed by users and travel straight into the HTML we send. Without
 * escaping, a reason containing markup becomes markup in the recipient's
 * inbox — and mail clients render enough HTML for that to matter.
 *
 * Ampersand is replaced first; doing it later would double-escape the
 * entities introduced by the other replacements.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
