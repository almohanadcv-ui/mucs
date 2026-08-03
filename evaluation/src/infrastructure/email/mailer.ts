import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { graphSend, isMailConfigured, type GraphAttachment } from "./graph";

export const LOGO_CID = "mab-logo";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative; HTML-only mail scores worse with spam filters. */
  text?: string;
}

// Read the wordmark from disk once. `next start` serves the app from the
// project root, so public/ is present at runtime. Cached across sends.
let logoPromise: Promise<Buffer | null> | null = null;
function loadLogo(): Promise<Buffer | null> {
  if (!logoPromise) {
    logoPromise = readFile(path.join(process.cwd(), "public", "mab-logo.png")).catch(() => null);
  }
  return logoPromise;
}

/**
 * Send a system email. Returns whether it was actually dispatched.
 *
 * When mail is not configured this is a no-op that logs — outside production it
 * also prints the subject so a developer can see what would have gone out
 * without needing Graph credentials. Callers that must not silently swallow a
 * failure (the login code) check the return value / catch the throw.
 */
export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!isMailConfigured()) {
    console.warn(
      `[email] not configured — skipped "${mail.subject}" → ${mail.to}` +
        (process.env.NODE_ENV !== "production" ? "\n" + (mail.text ?? "") : ""),
    );
    return false;
  }

  const attachments: GraphAttachment[] = [];
  if (mail.html.includes(`cid:${LOGO_CID}`)) {
    const logo = await loadLogo();
    if (logo) {
      attachments.push({
        filename: "mab-logo.png",
        content: logo,
        contentType: "image/png",
        cid: LOGO_CID,
      });
    }
  }

  await graphSend({
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: attachments.length ? attachments : undefined,
  });
  return true;
}
