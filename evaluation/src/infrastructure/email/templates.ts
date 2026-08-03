import "server-only";
import { getServerEnv } from "@/lib/env";
import { LOGO_CID } from "./mailer";

/** The system's own name in the inbox — each product signs its own mail. */
function brand(): string {
  return getServerEnv().MAIL_FROM_NAME;
}

function appUrl(): string {
  return getServerEnv().APP_URL.replace(/\/$/, "");
}

/**
 * Shared RTL shell. Inline styles only — email clients strip <style> and have
 * no CSS cascade to rely on. The logo is a `cid:` reference the mailer attaches
 * inline, because Outlook blocks remote images on first open.
 */
function shell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f4f5f7;padding:24px 12px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
      <tr>
        <td style="background:#0f2b46;padding:20px 28px;text-align:center;">
          <img src="cid:${LOGO_CID}" alt="MAB" height="34" style="height:34px;display:inline-block;" />
          <div style="color:#cbd7e6;font-size:12px;margin-top:6px;">${brand()}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">${bodyHtml}</td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e4e7eb;color:#7b8794;font-size:12px;text-align:center;">
          هذه رسالة آلية من ${brand()} — الرجاء عدم الرد عليها.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Six-digit sign-in code, mirroring MICA's login challenge email. */
export function loginCodeEmail(code: string, name?: string): EmailContent {
  const greeting = name ? `مرحبًا ${escapeHtml(name)}،` : "مرحبًا،";
  const body = `
    <p style="margin:0 0 12px;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#3e4c59;">رمز تسجيل الدخول الخاص بك:</p>
    <div style="text-align:center;margin:0 0 20px;">
      <span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:700;color:#0f2b46;background:#eef2f7;border-radius:10px;padding:14px 24px;direction:ltr;">${code}</span>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#7b8794;">صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.</p>
    <p style="margin:0;font-size:13px;color:#7b8794;">إن لم تكن من طلب الدخول، تجاهل هذه الرسالة.</p>`;
  return {
    subject: `رمز تسجيل الدخول — ${brand()}`,
    html: shell(body),
    text: `${greeting}\nرمز تسجيل الدخول: ${code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
  };
}

/** Reminder to an evaluator that an employee's probation is ending soon. */
export function probationReminderEmail(params: {
  evaluatorName?: string;
  employeeName: string;
  daysLeft: number;
  endDate: Date;
}): EmailContent {
  const { evaluatorName, employeeName, daysLeft, endDate } = params;
  const greeting = evaluatorName ? `مرحبًا ${escapeHtml(evaluatorName)}،` : "مرحبًا،";
  const dateStr = endDate.toLocaleDateString("en-CA"); // YYYY-MM-DD, locale-stable
  const link = `${appUrl()}/dashboard/evaluations/new`;
  const body = `
    <p style="margin:0 0 12px;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:15px;color:#3e4c59;">
      تبقّى <strong>${daysLeft}</strong> يومًا على انتهاء فترة تجربة الموظف
      <strong>${escapeHtml(employeeName)}</strong> (تنتهي في ${dateStr}).
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#3e4c59;">الرجاء إجراء تقييم الأداء قبل انتهاء الفترة.</p>
    <div style="text-align:center;margin:0 0 8px;">
      <a href="${link}" style="display:inline-block;background:#0f6b46;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;padding:12px 28px;">ابدأ التقييم الآن</a>
    </div>`;
  return {
    subject: `تذكير: تقييم ${employeeName} قبل انتهاء التجربة (${daysLeft} يومًا)`,
    html: shell(body),
    text: `${greeting}\nتبقّى ${daysLeft} يومًا على انتهاء تجربة ${employeeName} (${dateStr}).\nالرجاء إجراء التقييم: ${link}`,
  };
}

export interface EvaluationResultItem {
  label: string;
  value: string;
  remarks?: string | null;
}

/** The employee's own appraisal result, sent after a reviewer approves it. */
export function evaluationResultEmail(params: {
  employeeName: string;
  templateTitle: string;
  score: number | null;
  reviewedAt: Date;
  items: EvaluationResultItem[];
}): EmailContent {
  const { employeeName, templateTitle, score, reviewedAt, items } = params;
  const dateStr = reviewedAt.toLocaleDateString("en-CA");
  const scoreBlock =
    score != null
      ? `<div style="text-align:center;margin:0 0 20px;">
           <div style="font-size:13px;color:#7b8794;margin-bottom:4px;">النتيجة الإجمالية</div>
           <span style="display:inline-block;font-size:30px;font-weight:700;color:#0f6b46;background:#eaf5ef;border-radius:10px;padding:10px 26px;direction:ltr;">${score} / 100</span>
         </div>`
      : "";
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef1f4;font-size:14px;color:#3e4c59;vertical-align:top;">${escapeHtml(it.label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef1f4;font-size:14px;color:#1f2933;font-weight:600;white-space:nowrap;vertical-align:top;">${escapeHtml(it.value)}</td>
      </tr>${
        it.remarks
          ? `<tr><td colspan="2" style="padding:0 12px 10px;border-bottom:1px solid #eef1f4;font-size:12px;color:#7b8794;">ملاحظة: ${escapeHtml(it.remarks)}</td></tr>`
          : ""
      }`,
    )
    .join("");
  const body = `
    <p style="margin:0 0 12px;font-size:15px;">مرحبًا ${escapeHtml(employeeName)}،</p>
    <p style="margin:0 0 20px;font-size:15px;color:#3e4c59;">
      تم اعتماد تقييم أدائك «${escapeHtml(templateTitle)}» بتاريخ ${dateStr}. فيما يلي تفاصيله:
    </p>
    ${scoreBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eef1f4;border-radius:8px;overflow:hidden;">
      ${rows || `<tr><td style="padding:12px;font-size:14px;color:#7b8794;">لا توجد بنود مفصّلة.</td></tr>`}
    </table>`;
  return {
    subject: `نتيجة تقييم الأداء — ${templateTitle}`,
    html: shell(body),
    text:
      `مرحبًا ${employeeName}،\nتم اعتماد تقييم أدائك «${templateTitle}» بتاريخ ${dateStr}.` +
      (score != null ? `\nالنتيجة الإجمالية: ${score} / 100` : "") +
      "\n\n" +
      items.map((it) => `- ${it.label}: ${it.value}${it.remarks ? ` (ملاحظة: ${it.remarks})` : ""}`).join("\n"),
  };
}
