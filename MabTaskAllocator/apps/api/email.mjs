// Microsoft Graph email transport (app-only / client-credentials) for the Task
// Allocator. Reuses the same Azure app registration as MICA / the Evaluation
// system — set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / MAIL_FROM
// (+ optional MAIL_FROM_NAME) in apps/api/.env. Best-effort: callers wrap sends
// in try/catch so a mail hiccup never breaks the request.

function config() {
  const missing = [];
  if (!process.env.GRAPH_TENANT_ID) missing.push("GRAPH_TENANT_ID");
  if (!process.env.GRAPH_CLIENT_ID) missing.push("GRAPH_CLIENT_ID");
  if (!process.env.GRAPH_CLIENT_SECRET) missing.push("GRAPH_CLIENT_SECRET");
  if (!process.env.MAIL_FROM) missing.push("MAIL_FROM");
  if (missing.length) {
    const error = new Error(`Microsoft Graph mail is not configured — missing: ${missing.join(", ")}.`);
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }
  return {
    tenantId: process.env.GRAPH_TENANT_ID,
    clientId: process.env.GRAPH_CLIENT_ID,
    clientSecret: process.env.GRAPH_CLIENT_SECRET,
    from: process.env.MAIL_FROM,
    fromName: process.env.MAIL_FROM_NAME || "MAB Task Allocator",
  };
}

export function isMailConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

let cachedToken = null; // { value, expiresAt }

async function accessToken(cfg) {
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
    const detail = await res.text();
    throw new Error(`Graph token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

/**
 * Send one HTML email through Graph. Resolves on success; throws on a transport
 * failure or MAIL_NOT_CONFIGURED. Callers should catch and log, never block on it.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return false;
  const cfg = config();
  const token = await accessToken(cfg);
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      from: { emailAddress: { address: cfg.from, name: cfg.fromName } },
      toRecipients: [{ emailAddress: { address: to } }],
    },
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
  return true;
}
