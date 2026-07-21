import { escapeHtml } from "../escape-html";
import { MAB_LOGO_CID } from "./mab-logo";

/**
 * Shared shell for MICA emails, in MAB's identity.
 *
 * Built with tables and inline styles rather than modern CSS because Outlook
 * renders mail through Word's HTML engine: flexbox, grid, and external
 * stylesheets are ignored there, and a layout that looks right in a browser
 * can collapse in the client these recipients actually use. Every colour is
 * written literally for the same reason — custom properties do not resolve.
 */

/** Taken from the wordmark itself (mcs-landing/public/mab-logo.svg). */
const BRAND = "#1b76bd";
const BRAND_DEEP = "#155e97";
const BRAND_LIGHT = "#4f97d3";
const INK = "#16202b";
const BODY = "#4a5a6a";
const MUTED = "#7b8a99";
const LINE = "#e2e8ef";
const CANVAS = "#eef2f6";
const TINT = "#f5f8fb";

/** Accent per message kind: what the reader should feel before reading. */
export type EmailAccent = "action" | "positive" | "negative";
const ACCENT: Record<EmailAccent, string> = {
  action: BRAND,
  positive: "#15803d",
  negative: "#c0392b",
};

export interface EmailButton {
  label: string;
  url: string;
  kind?: "primary" | "danger" | "quiet";
}

export interface EmailRow {
  label: string;
  value: string;
  /** Renders larger and in the accent colour — for the one number that matters. */
  emphasis?: boolean;
}

export interface EmailContent {
  accent: EmailAccent;
  eyebrow: string;
  heading: string;
  intro: string;
  rows: EmailRow[];
  callout?: { label: string; body: string };
  buttons?: EmailButton[];
  footnote?: string;
}

function button({ label, url, kind = "quiet" }: EmailButton, accent: string): string {
  const style =
    kind === "primary"
      ? `background:${accent};border:1px solid ${accent};color:#ffffff`
      : kind === "danger"
        ? `background:#ffffff;border:1px solid #c0392b;color:#c0392b`
        : `background:#ffffff;border:1px solid ${LINE};color:${BODY}`;

  return `<td style="padding:0 4px 8px" dir="rtl">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 26px;border-radius:6px;${style};font-size:14px;font-weight:bold;text-decoration:none;font-family:'Segoe UI',Tahoma,Arial,sans-serif">${escapeHtml(label)}</a>
  </td>`;
}

export function renderEmail(content: EmailContent): string {
  const accent = ACCENT[content.accent];

  const rows = content.rows
    .map(
      (r, i) => `<tr>
        <td style="padding:11px 0;border-top:${i === 0 ? "0" : `1px solid ${LINE}`};color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(r.label)}</td>
        <td style="padding:11px 0 11px 16px;border-top:${i === 0 ? "0" : `1px solid ${LINE}`};color:${r.emphasis ? accent : INK};font-size:${r.emphasis ? "19px" : "14px"};font-weight:bold;text-align:left;direction:ltr">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  const callout = content.callout
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 0;background:${TINT};border-right:3px solid ${accent};border-radius:4px">
        <tr><td style="padding:14px 16px">
          <p style="margin:0 0 4px;color:${MUTED};font-size:11px;font-weight:bold;letter-spacing:0.4px">${escapeHtml(content.callout.label)}</p>
          <p style="margin:0;color:${INK};font-size:14px;line-height:1.7">${escapeHtml(content.callout.body)}</p>
        </td></tr>
      </table>`
    : "";

  const buttons = content.buttons?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr>${content.buttons
        .map((b) => button(b, accent))
        .join("")}</tr></table>`
    : "";

  const footnote = content.footnote
    ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.75">${escapeHtml(content.footnote)}</p>`
    : "";

  return `<div dir="rtl" lang="ar" style="margin:0;padding:32px 12px;background:${CANVAS};font-family:'Segoe UI',Tahoma,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(21,32,43,0.08)">

    <tr><td style="height:4px;background:${BRAND};font-size:0;line-height:0">&nbsp;</td></tr>

    <tr><td style="padding:22px 30px 18px;border-bottom:1px solid ${LINE}">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="vertical-align:middle">
          <img src="cid:${MAB_LOGO_CID}" width="104" alt="MAB" style="display:block;width:104px;height:auto;border:0" />
        </td>
        <td style="vertical-align:middle;text-align:left;direction:ltr">
          <span style="color:${BRAND_DEEP};font-size:15px;font-weight:bold;letter-spacing:1.5px">MICA</span><br/>
          <span style="color:${MUTED};font-size:11px;letter-spacing:0.3px">Fleet Management</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:28px 30px 30px">
      <p style="margin:0 0 8px;color:${accent};font-size:11px;font-weight:bold;letter-spacing:1px">${escapeHtml(content.eyebrow)}</p>
      <h1 style="margin:0 0 10px;color:${INK};font-size:22px;line-height:1.4;font-weight:bold">${escapeHtml(content.heading)}</h1>
      <p style="margin:0 0 22px;color:${BODY};font-size:15px;line-height:1.75">${escapeHtml(content.intro)}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${LINE};border-radius:8px">
        <tr><td style="padding:6px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>
        </td></tr>
      </table>

      ${callout}
      ${buttons}
      ${footnote}
    </td></tr>

    <tr><td style="padding:16px 30px;background:${TINT};border-top:1px solid ${LINE}">
      <p style="margin:0;color:${MUTED};font-size:11px;line-height:1.7">
        رسالة آلية من نظام MICA — مجموعة MAB. لا ترد على هذا البريد.
      </p>
    </td></tr>

    <tr><td style="height:3px;background:${BRAND_LIGHT};font-size:0;line-height:0">&nbsp;</td></tr>
  </table>
</div>`;
}

/**
 * Plain-text alternative. Not optional politeness: mail carrying only an HTML
 * part scores worse with spam filters, and some clients show nothing without it.
 */
export function renderText(content: EmailContent): string {
  const lines = [
    "MAB — نظام MICA لإدارة الأسطول",
    "=".repeat(34),
    "",
    content.heading,
    "",
    content.intro,
    "",
    ...content.rows.map((r) => `${r.label}: ${r.value}`),
  ];
  if (content.callout) lines.push("", `${content.callout.label}: ${content.callout.body}`);
  if (content.buttons?.length) {
    lines.push("", ...content.buttons.map((b) => `${b.label}:\n${b.url}`));
  }
  if (content.footnote) lines.push("", content.footnote);
  lines.push("", "رسالة آلية من نظام MICA — مجموعة MAB. لا ترد على هذا البريد.");
  return lines.join("\n");
}

/** Every MICA subject carries the tag so recipients can rule on it in Outlook. */
export function subject(text: string): string {
  return `[MICA] ${text}`;
}
