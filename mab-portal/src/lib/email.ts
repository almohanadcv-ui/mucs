import "server-only";
import { env, isMailConfigured } from "./env";

// ── Microsoft Graph transport (app-only), same pattern as the other systems ──
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const body = new URLSearchParams({
    client_id: env.GRAPH_CLIENT_ID,
    client_secret: env.GRAPH_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${env.GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Graph token failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export async function graphSend(to: string, subject: string, html: string): Promise<void> {
  const token = await accessToken();
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      from: { emailAddress: { address: env.MAIL_FROM, name: env.MAIL_FROM_NAME } },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.MAIL_FROM)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`Graph sendMail failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const NAVY = "#0f2b46";
const FONT = "'Segoe UI',Tahoma,'Helvetica Neue',Arial,'Noto Naskh Arabic',sans-serif";

/** Branded RTL wrapper for any portal email. `eyebrow` is the small pill label. */
export function emailShell(opts: { eyebrow: string; accent?: string; title: string; bodyHtml: string }): string {
  const accent = opts.accent ?? "#1178b8";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;"><tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6eaf0;">
      <tr><td style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY},#173a5e);padding:24px 32px;text-align:center;color:#fff;font-family:${FONT};font-size:20px;font-weight:800;">منصّة MAB</td></tr>
      <tr><td style="padding:30px 32px;font-family:${FONT};color:#1f2a37;">
        <span style="display:inline-block;background:${accent}1a;color:${accent};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${esc(opts.eyebrow)}</span>
        <h1 style="margin:14px 0 16px;font-size:20px;line-height:1.5;color:${NAVY};">${esc(opts.title)}</h1>
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 32px;background:#f7f9fb;border-top:1px solid #e6eaf0;font-family:${FONT};text-align:center;color:#64748b;font-size:12px;">رسالة آلية من منصّة MAB — الرجاء عدم الرد.<br/>© ${new Date().getFullYear()} MAB United.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** Generic branded send (no-op with a console note when mail isn't configured). */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!isMailConfigured()) {
    console.warn(`[portal] mail not configured — skipped "${subject}" → ${to}`);
    return;
  }
  await graphSend(to, subject, html);
}

/** The branded sign-in code email for the portal. */
export async function sendLoginCode(to: string, name: string, code: string): Promise<void> {
  if (!isMailConfigured()) {
    console.warn(`[portal] mail not configured — code for ${to} is ${code}`);
    return;
  }
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;"><tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6eaf0;">
      <tr><td style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY},#173a5e);padding:26px 32px;text-align:center;color:#fff;font-family:${FONT};font-size:20px;font-weight:800;">منصّة MAB</td></tr>
      <tr><td style="padding:32px;font-family:${FONT};color:#1f2a37;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.9;">مرحبًا ${esc(name)} 👋</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.9;">رمز الدخول إلى منصّة MAB:</p>
        <div style="text-align:center;margin:8px 0 18px;"><span style="display:inline-block;background:#f1f5fb;border:1px solid #dbe4f0;border-radius:12px;padding:16px 30px;font-family:'Segoe UI',Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:${NAVY};direction:ltr;">${esc(code)}</span></div>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.8;">صالح ١٠ دقائق ويُستخدم مرة واحدة. لا تُشاركه مع أحد.</p>
        <p style="margin:18px 0 0;font-size:14px;">تحيّاتنا،<br/><strong>قسم تقنية المعلومات (IT)</strong></p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f7f9fb;border-top:1px solid #e6eaf0;font-family:${FONT};text-align:center;color:#64748b;font-size:12px;">رسالة آلية من منصّة MAB — الرجاء عدم الرد.<br/>© ${new Date().getFullYear()} MAB United.</td></tr>
    </table>
  </td></tr></table></body></html>`;
  await graphSend(to, `${code} رمز الدخول إلى منصّة MAB`, html);
}
