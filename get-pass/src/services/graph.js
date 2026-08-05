/*
 * graph.js — إرسال البريد عبر Microsoft Graph (app-only / client-credentials).
 * منقول من نظام التقييم (evaluation/src/infrastructure/email/graph.ts) إلى JS عادي.
 * يُعاد استخدام نفس تسجيل تطبيق Azure الخاص بالميكا/التقييم — فقط يحتاج
 * GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / MAIL_FROM.
 */
import { config } from '../config.js';

/** هل ضُبطت بيانات Graph بما يكفي للإرسال؟ */
export function isGraphConfigured() {
  const g = config.graph;
  return Boolean(g.tenantId && g.clientId && g.clientSecret && g.from);
}

// التوكن يدوم ساعة؛ نُخزّنه ونُجدّده قبل انتهائه بدقيقة حتى لا ينتهي أثناء الطلب.
let cachedToken = null;

async function accessToken() {
  const g = config.graph;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const body = new URLSearchParams({
    client_id: g.clientId,
    client_secret: g.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${g.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

async function attempt({ to, subject, html, text }) {
  const g = config.graph;
  const token = await accessToken();
  const payload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      // اسم المُرسِل يُظهر النظام قبل عنوان البريد.
      from: { emailAddress: { address: g.from, name: g.fromName } },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };
  void text; // Graph يرسل HTML؛ النص الصِّرف غير مستخدم هنا
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(g.from)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/** إرسال رسالة عبر Graph. عند 403 (توكن قديم قبل منح الصلاحية) يُعيد المحاولة مرة. */
export async function graphSend(message) {
  try {
    await attempt(message);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes('(403)')) throw e;
    cachedToken = null;
    await attempt(message);
  }
}
