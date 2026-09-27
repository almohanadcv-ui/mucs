// English, table-based HTML email templates with inline styles (email clients
// strip <style>). One shared shell keeps every message on-brand, with a clear
// call-to-action link back into the app.

const NAVY = "#0f2b46";
const NAVY_2 = "#16466e";
const INK = "#1f2d3d";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const CANVAS = "#eef2f7";
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render mention markup @[Name] as bold, and keep the rest escaped.
function renderBody(body) {
  return escapeHtml(body).replace(/@\[([^\]]+)\]/g, '<strong style="color:' + NAVY + '">@$1</strong>');
}

function button(href, label, color) {
  if (!href) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="border-radius:10px;background:${color};">
    <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function shell({ preheader, eyebrow, accent, title, contentHtml }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /></head>
  <body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr><td align="center" style="padding:28px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};box-shadow:0 4px 16px rgba(15,43,70,.08);">
          <tr><td style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,${NAVY_2} 100%);padding:24px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:20px;font-weight:800;font-family:${FONT};letter-spacing:.3px;">MAB Task Allocator</div>
          </td></tr>
          <tr><td style="padding:30px 32px;font-family:${FONT};">
            <span style="display:inline-block;background:${accent}1a;color:${accent};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.4px;">${escapeHtml(eyebrow)}</span>
            <h1 style="margin:16px 0 14px;font-size:21px;line-height:1.4;color:${NAVY};font-weight:700;">${escapeHtml(title)}</h1>
            ${contentHtml}
          </td></tr>
          <tr><td style="padding:18px 32px;background:#f7f9fb;border-top:1px solid ${LINE};font-family:${FONT};">
            <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.7;text-align:center;">Automated message from MAB Task Allocator — please do not reply.<br />© ${year} MAB United. All rights reserved.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function para(html) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:${INK};">${html}</p>`;
}

// Per-notification-kind presentation.
const KIND_META = {
  assignment: { eyebrow: "New Task", accent: "#2563eb", cta: "Open task" },
  reminder: { eyebrow: "Deadline Reminder", accent: "#d97706", cta: "Open task" },
  mention: { eyebrow: "You were mentioned", accent: "#7c3aed", cta: "View conversation" },
  approval_request: { eyebrow: "Approval Needed", accent: "#0d9488", cta: "Review submission" },
  approval: { eyebrow: "Task Approved", accent: "#16a34a", cta: "Open task" },
  review: { eyebrow: "Task Reopened", accent: "#dc2626", cta: "Open task" },
  delay: { eyebrow: "Delay Alert", accent: "#dc2626", cta: "Open task" },
  project: { eyebrow: "Project Update", accent: "#2563eb", cta: "Open project" },
  claim: { eyebrow: "Allocation", accent: "#0d9488", cta: "Open task" },
};

/** Build an email for an in-app notification. Returns { subject, html, text }. */
export function notificationEmail({ kind, name, title, body, link }) {
  const meta = KIND_META[kind] ?? { eyebrow: "Notification", accent: NAVY, cta: "Open in app" };
  const contentHtml =
    para(`Hi ${escapeHtml(name || "there")},`) +
    para(renderBody(body)) +
    button(link, meta.cta, meta.accent) +
    (link
      ? para(`<span style="color:${MUTED};font-size:12px;">If the button doesn't work, open: <a href="${link}" style="color:${meta.accent};word-break:break-all;">${escapeHtml(link)}</a></span>`)
      : "");
  return {
    subject: title,
    html: shell({ preheader: body, eyebrow: meta.eyebrow, accent: meta.accent, title, contentHtml }),
    text: `${title}\n\n${body}${link ? `\n\n${meta.cta}: ${link}` : ""}`,
  };
}

/** New-device verification code email. */
export function deviceCodeEmail({ name, code }) {
  const accent = "#2563eb";
  const contentHtml =
    para(`Hi ${escapeHtml(name || "there")},`) +
    para("We noticed a sign-in from a <strong>new device</strong>. Enter this verification code to continue:") +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;width:100%;"><tr><td align="center">
       <div style="display:inline-block;background:#f1f5fb;border:1px solid #dbe4f0;border-radius:12px;padding:16px 30px;font-family:'Segoe UI',Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:12px;color:${NAVY};">${escapeHtml(code)}</div>
     </td></tr></table>` +
    para(`<span style="color:${MUTED};font-size:13px;">The code is valid for <strong>10 minutes</strong> and can be used once. If this wasn't you, ignore this email and consider changing your password.</span>`);
  return {
    subject: `${code} is your MAB Task Allocator verification code`,
    html: shell({ preheader: `${code} is your verification code`, eyebrow: "Verify device", accent, title: "Verify your new device", contentHtml }),
    text: `Your verification code is ${code}. It is valid for 10 minutes.`,
  };
}
