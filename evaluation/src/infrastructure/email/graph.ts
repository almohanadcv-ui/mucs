import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * Microsoft Graph email transport (app-only / client-credentials).
 *
 * This is the transport Microsoft still supports: basic authentication for SMTP
 * submission was disabled on Exchange Online, and a tenant with Security
 * Defaults on rejects it outright. Graph works with those protections left on.
 *
 * The same Azure app registration as MICA is reused; an Application Access
 * Policy on the tenant scopes it to the one sending mailbox, so the credential
 * is no more powerful than this feature needs.
 *
 * Ported from mica/apps/api/src/queues/providers/graph-email.provider.ts and
 * reduced to plain functions (no Nest DI) reading the validated server env.
 */

export interface GraphAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Set for inline images referenced by `cid:` in the HTML. */
  cid?: string;
}

export interface GraphMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: GraphAttachment[];
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/** Tokens last an hour; re-fetching per message would be a needless round trip. */
let cachedToken: { value: string; expiresAt: number } | null = null;

export class MailNotConfiguredError extends Error {}

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  from: string;
  fromName: string;
}

/** Read + assert the Graph config, or throw a single clear error naming what's missing. */
export function graphConfig(): GraphConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.GRAPH_TENANT_ID) missing.push("GRAPH_TENANT_ID");
  if (!env.GRAPH_CLIENT_ID) missing.push("GRAPH_CLIENT_ID");
  if (!env.GRAPH_CLIENT_SECRET) missing.push("GRAPH_CLIENT_SECRET");
  if (!env.MAIL_FROM) missing.push("MAIL_FROM");
  if (missing.length) {
    throw new MailNotConfiguredError(
      `Microsoft Graph mail is not configured — missing: ${missing.join(", ")}.`,
    );
  }
  return {
    tenantId: env.GRAPH_TENANT_ID!,
    clientId: env.GRAPH_CLIENT_ID!,
    clientSecret: env.GRAPH_CLIENT_SECRET!,
    from: env.MAIL_FROM!,
    fromName: env.MAIL_FROM_NAME,
  };
}

/** True when enough is configured to attempt a send (used for dev fallbacks). */
export function isMailConfigured(): boolean {
  try {
    graphConfig();
    return true;
  } catch {
    return false;
  }
}

async function accessToken(cfg: GraphConfig): Promise<string> {
  // Refreshed a minute early so a token cannot expire mid-request.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    // The body names the actual cause (expired secret, consent not granted) and
    // carries no secret of ours, so it is worth surfacing.
    const detail = await res.text();
    throw new Error(`Graph token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as TokenResponse;
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function attempt(cfg: GraphConfig, message: GraphMessage): Promise<void> {
  const token = await accessToken(cfg);

  const payload = {
    message: {
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      // A recipient reads the sender's name long before the address, so it says
      // which system the mail is from rather than whatever the mailbox is named.
      from: { emailAddress: { address: cfg.from, name: cfg.fromName } },
      toRecipients: [{ emailAddress: { address: message.to } }],
      attachments: (message.attachments ?? []).map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType,
        contentBytes: a.content.toString("base64"),
        contentId: a.cid,
        isInline: Boolean(a.cid),
      })),
    },
    // The sending mailbox is a system address, not someone's inbox: keeping a
    // copy of every notification would just bury it in its own Sent Items.
    saveToSentItems: false,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.from)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Send one message through Graph. Throws MailNotConfiguredError when mail isn't
 * set up, and Error on a transport failure.
 */
export async function graphSend(message: GraphMessage): Promise<void> {
  const cfg = graphConfig();
  try {
    await attempt(cfg, message);
  } catch (e) {
    // A cached token predates any permission change, so the first send after an
    // admin grants Mail.Send is refused with a token that never carried the
    // role. Dropping it and retrying once turns a "restart the server" problem
    // into a transparent recovery. Only 403 is retried: 401 means the
    // credentials are wrong and retrying would just repeat.
    if (!(e instanceof Error) || !e.message.includes("(403)")) throw e;
    cachedToken = null;
    await attempt(cfg, message);
  }
}
