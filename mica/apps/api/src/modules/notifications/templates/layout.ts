import { escapeHtml } from "../escape-html";

/**
 * Shared shell for MICA emails.
 *
 * Built with tables and inline styles rather than modern CSS because Outlook
 * renders mail through Word's HTML engine: flexbox, grid and external
 * stylesheets are ignored there, and a layout that looks right in a browser
 * can collapse in the client most of these recipients actually use.
 */

export interface EmailButton {
  label: string;
  url: string;
  /** The primary action is filled; the rest are outlined. */
  primary?: boolean;
}

export interface EmailRow {
  label: string;
  value: string;
}

export interface EmailContent {
  heading: string;
  intro: string;
  rows: EmailRow[];
  buttons?: EmailButton[];
  footnote?: string;
}

const BRAND = "#0f766e";
const TEXT = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

function button({ label, url, primary }: EmailButton): string {
  const bg = primary ? BRAND : "#ffffff";
  const fg = primary ? "#ffffff" : BRAND;
  return `<td style="padding:0 6px">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 22px;border-radius:6px;border:1px solid ${BRAND};background:${bg};color:${fg};font-weight:bold;font-size:14px;text-decoration:none">${escapeHtml(label)}</a>
  </td>`;
}

export function renderEmail(content: EmailContent): string {
  const rows = content.rows
    .map(
      (r) => `<tr>
        <td style="padding:7px 0;color:${MUTED};font-size:13px;white-space:nowrap">${escapeHtml(r.label)}</td>
        <td style="padding:7px 0 7px 14px;color:${TEXT};font-size:14px;font-weight:bold">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  const buttons = content.buttons?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr>${content.buttons.map(button).join("")}</tr></table>`
    : "";

  const footnote = content.footnote
    ? `<p style="margin:18px 0 0;color:${MUTED};font-size:12px;line-height:1.7">${escapeHtml(content.footnote)}</p>`
    : "";

  return `<div dir="rtl" lang="ar" style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BORDER};border-radius:10px">
    <tr><td style="padding:20px 26px;border-bottom:1px solid ${BORDER}">
      <span style="color:${BRAND};font-size:17px;font-weight:bold">MICA</span>
      <span style="color:${MUTED};font-size:13px"> · نظام إدارة الأسطول</span>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <h1 style="margin:0 0 8px;color:${TEXT};font-size:19px">${escapeHtml(content.heading)}</h1>
      <p style="margin:0 0 16px;color:${MUTED};font-size:14px;line-height:1.7">${escapeHtml(content.intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>
      ${buttons}
      ${footnote}
    </td></tr>
    <tr><td style="padding:14px 26px;border-top:1px solid ${BORDER};color:${MUTED};font-size:11px">
      رسالة آلية من نظام MICA. لا ترد على هذا البريد.
    </td></tr>
  </table>
</div>`;
}

/**
 * Plain-text alternative. Not optional politeness: mail carrying only an HTML
 * part scores worse with spam filters, and some clients show nothing without it.
 */
export function renderText(content: EmailContent): string {
  const lines = [
    content.heading,
    "",
    content.intro,
    "",
    ...content.rows.map((r) => `${r.label}: ${r.value}`),
  ];
  if (content.buttons?.length) {
    lines.push("", ...content.buttons.map((b) => `${b.label}: ${b.url}`));
  }
  if (content.footnote) lines.push("", content.footnote);
  lines.push("", "رسالة آلية من نظام MICA. لا ترد على هذا البريد.");
  return lines.join("\n");
}

/** Every MICA subject carries the tag so recipients can rule on it in Outlook. */
export function subject(text: string): string {
  return `[MICA] ${text}`;
}
