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

// ── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY = "#0f2b46";
const NAVY_2 = "#173a5e";
const INK = "#1f2a37";
const MUTED = "#64748b";
const LINE = "#e6eaf0";
const CANVAS = "#eef1f5";
const FONT =
  "'Segoe UI',Tahoma,'Helvetica Neue',Arial,'Noto Naskh Arabic',sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Isolate a possibly-Latin value (a name, a number) inside RTL Arabic text so
 * the surrounding punctuation doesn't jump to the wrong side — the cause of the
 * mangled «مرحبًا Name،» seen in Outlook.
 */
function iso(value: string): string {
  return `<span dir="auto" style="unicode-bidi:isolate">${escapeHtml(value)}</span>`;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

interface ShellParams {
  /** One-line inbox summary — decides how the mail reads before it's opened. */
  preheader: string;
  /** Small type label (تذكير / نتيجة تقييم / رمز دخول). */
  eyebrow: string;
  /** Accent for the eyebrow + rule, per message type. */
  accent: string;
  /** Main heading. */
  title: string;
  /** Inner body HTML (already escaped where needed). */
  content: string;
}

/**
 * One professional RTL shell for every message. Table-based with inline styles
 * only — email clients strip <style> and have no reliable cascade. The logo is
 * a `cid:` attachment because Outlook blocks remote images on first open.
 */
function shell(p: ShellParams): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(
      p.preheader,
    )}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};box-shadow:0 4px 16px rgba(15,43,70,.08);">
            <!-- header -->
            <tr>
              <td style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,${NAVY_2} 100%);padding:26px 32px;text-align:center;">
                <img src="cid:${LOGO_CID}" alt="MAB" height="40" style="height:40px;display:inline-block;border:0;" />
                <div style="color:#aebfd4;font-size:12px;font-family:${FONT};margin-top:8px;letter-spacing:.2px;">${escapeHtml(
                  brand(),
                )}</div>
              </td>
            </tr>
            <!-- body -->
            <tr>
              <td style="padding:32px;font-family:${FONT};">
                <span style="display:inline-block;background:${p.accent}1a;color:${p.accent};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${escapeHtml(
                  p.eyebrow,
                )}</span>
                <h1 style="margin:16px 0 18px;font-size:21px;line-height:1.5;color:${NAVY};font-weight:700;">${p.title}</h1>
                ${p.content}
              </td>
            </tr>
            <!-- footer -->
            <tr>
              <td style="padding:20px 32px;background:#f7f9fb;border-top:1px solid ${LINE};font-family:${FONT};">
                <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.7;text-align:center;">
                  رسالة آلية من ${escapeHtml(brand())} — الرجاء عدم الرد عليها.<br />
                  © ${year} MAB United. جميع الحقوق محفوظة.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A reusable paragraph. */
function para(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:${INK};">${html}</p>`;
}

/** A solid call-to-action button (bulletproof-ish for Outlook via padding). */
function button(href: string, label: string, color = NAVY): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${color};">
    <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(
      label,
    )}</a>
  </td></tr></table>`;
}

function greeting(name?: string): string {
  return para(name ? `مرحبًا ${iso(name)}،` : "مرحبًا،");
}

// ── Login code ───────────────────────────────────────────────────────────────
export function loginCodeEmail(code: string, name?: string): EmailContent {
  const accent = "#2563eb";
  const content = `
    ${greeting(name)}
    ${para("استخدم الرمز التالي لإكمال تسجيل الدخول إلى حسابك:")}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;width:100%;"><tr><td align="center">
      <div style="display:inline-block;background:#f1f5fb;border:1px solid #dbe4f0;border-radius:12px;padding:16px 28px;font-family:'Segoe UI',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:12px;color:${NAVY};direction:ltr;">${code}</div>
    </td></tr></table>
    ${para(
      `<span style="color:${MUTED};font-size:13px;">هذا الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة. لا تُشاركه مع أي شخص — لن يطلبه منك أحد من فريق العمل.</span>`,
    )}
    ${para(
      `<span style="color:${MUTED};font-size:13px;">إن لم تكن أنت من حاول تسجيل الدخول، تجاهل هذه الرسالة بأمان.</span>`,
    )}`;
  return {
    subject: `رمز الدخول: ${code} — ${brand()}`,
    html: shell({
      preheader: `رمز تسجيل الدخول الخاص بك هو ${code} (صالح لـ10 دقائق).`,
      eyebrow: "رمز دخول",
      accent,
      title: "رمز تسجيل الدخول",
      content,
    }),
    text: `مرحبًا${name ? " " + name : ""}،\nرمز تسجيل الدخول: ${code}\nصالح لمدة 10 دقائق ويُستخدم مرة واحدة. لا تُشاركه مع أحد.`,
  };
}

// ── Password reset link ──────────────────────────────────────────────────────
export function passwordResetEmail(link: string, name?: string): EmailContent {
  const accent = "#2563eb";
  const content = `
    ${greeting(name)}
    ${para("وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط الزر التالي لتعيين كلمة مرور جديدة:")}
    ${button(link, "إعادة تعيين كلمة المرور", accent)}
    ${para(
      `<span style="color:${MUTED};font-size:13px;">هذا الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة. إن لم تطلب ذلك، تجاهل هذه الرسالة وكلمة مرورك تبقى كما هي.</span>`,
    )}
    ${para(
      `<span style="color:${MUTED};font-size:12px;">إن لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفّح:<br /><span dir="ltr" style="word-break:break-all;color:${accent};">${escapeHtml(
        link,
      )}</span></span>`,
    )}`;
  return {
    subject: `إعادة تعيين كلمة المرور — ${brand()}`,
    html: shell({
      preheader: "رابط إعادة تعيين كلمة مرور حسابك (صالح لـ30 دقيقة).",
      eyebrow: "إعادة تعيين",
      accent,
      title: "إعادة تعيين كلمة المرور",
      content,
    }),
    text: `مرحبًا${name ? " " + name : ""}،\nلإعادة تعيين كلمة مرورك افتح الرابط التالي (صالح 30 دقيقة):\n${link}\nإن لم تطلب ذلك فتجاهل هذه الرسالة.`,
  };
}

// ── Account invite ───────────────────────────────────────────────────────────
export function accountInviteEmail(link: string, name?: string): EmailContent {
  const accent = "#0f766e";
  const content = `
    ${greeting(name)}
    ${para(`تم إنشاء حساب لك على ${escapeHtml(brand())}. لتفعيل حسابك، اضغط الزر التالي وعيّن كلمة مرورك:`)}
    ${button(link, "تفعيل الحساب وتعيين كلمة المرور", accent)}
    ${para(
      `<span style="color:${MUTED};font-size:13px;">هذا الرابط صالح لمدة 7 أيام. بعد تعيين كلمة المرور تقدر تسجّل الدخول ببريدك الإلكتروني.</span>`,
    )}
    ${para(
      `<span style="color:${MUTED};font-size:12px;">إن لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفّح:<br /><span dir="ltr" style="word-break:break-all;color:${accent};">${escapeHtml(
        link,
      )}</span></span>`,
    )}`;
  return {
    subject: `تفعيل حسابك — ${brand()}`,
    html: shell({
      preheader: "تم إنشاء حساب لك — فعّله وعيّن كلمة مرورك (الرابط صالح 7 أيام).",
      eyebrow: "دعوة حساب",
      accent,
      title: "مرحبًا بك — فعّل حسابك",
      content,
    }),
    text: `مرحبًا${name ? " " + name : ""}،\nتم إنشاء حساب لك على ${brand()}. فعّل حسابك وعيّن كلمة مرورك عبر الرابط (صالح 7 أيام):\n${link}`,
  };
}

// ── Probation reminder ───────────────────────────────────────────────────────
export function probationReminderEmail(params: {
  evaluatorName?: string;
  employeeName: string;
  daysLeft: number;
  endDate: Date;
}): EmailContent {
  const { evaluatorName, employeeName, daysLeft, endDate } = params;
  const accent = daysLeft <= 30 ? "#dc2626" : "#d97706";
  const dateStr = endDate.toLocaleDateString("en-CA");
  const link = `${appUrl()}/dashboard/evaluations/new`;
  const content = `
    ${greeting(evaluatorName)}
    ${para(
      `تبقّى <strong style="color:${accent};">${daysLeft} يومًا</strong> على انتهاء فترة التجربة للموظف <strong>${iso(
        employeeName,
      )}</strong>.`,
    )}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;width:100%;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;font-family:${FONT};font-size:14px;color:${MUTED};background:#f7f9fb;border-left:1px solid ${LINE};">الموظف</td>
        <td style="padding:14px 18px;font-family:${FONT};font-size:14px;color:${INK};font-weight:600;">${iso(
          employeeName,
        )}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px;font-family:${FONT};font-size:14px;color:${MUTED};background:#f7f9fb;border-left:1px solid ${LINE};border-top:1px solid ${LINE};">تنتهي التجربة في</td>
        <td style="padding:14px 18px;font-family:${FONT};font-size:14px;color:${INK};font-weight:600;border-top:1px solid ${LINE};direction:ltr;text-align:right;">${dateStr}</td>
      </tr>
    </table>
    ${para("الرجاء إجراء تقييم الأداء قبل انتهاء الفترة لضمان اتخاذ القرار في وقته.")}
    ${button(link, "ابدأ التقييم الآن", "#0f766e")}`;
  return {
    subject: `تذكير تقييم: ${employeeName} — تبقّى ${daysLeft} يومًا على انتهاء التجربة`,
    html: shell({
      preheader: `فترة تجربة ${employeeName} تنتهي خلال ${daysLeft} يومًا (${dateStr}). الرجاء إجراء التقييم.`,
      eyebrow: "تذكير بتقييم",
      accent,
      title: "موعد تقييم أداء يقترب",
      content,
    }),
    text: `مرحبًا${evaluatorName ? " " + evaluatorName : ""}،\nتبقّى ${daysLeft} يومًا على انتهاء تجربة ${employeeName} (${dateStr}).\nالرجاء إجراء التقييم: ${link}`,
  };
}

// ── Evaluation result ────────────────────────────────────────────────────────
export interface EvaluationResultItem {
  label: string;
  value: string;
  remarks?: string | null;
}

export function evaluationResultEmail(params: {
  employeeName: string;
  templateTitle: string;
  score: number | null;
  reviewedAt: Date;
  items: EvaluationResultItem[];
}): EmailContent {
  const { employeeName, templateTitle, score, reviewedAt, items } = params;
  const accent = "#0f766e";
  const dateStr = reviewedAt.toLocaleDateString("en-CA");

  const scoreColor =
    score == null ? MUTED : score >= 75 ? "#0f766e" : score >= 50 ? "#d97706" : "#dc2626";
  const scoreBlock =
    score != null
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;width:100%;"><tr><td align="center">
           <div style="display:inline-block;min-width:200px;background:${scoreColor}0f;border:1px solid ${scoreColor}33;border-radius:14px;padding:18px 30px;">
             <div style="font-family:${FONT};font-size:12px;color:${MUTED};margin-bottom:6px;">النتيجة الإجمالية</div>
             <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:38px;font-weight:800;color:${scoreColor};line-height:1;direction:ltr;">${score}<span style="font-size:16px;color:${MUTED};font-weight:600;"> / 100</span></div>
           </div>
         </td></tr></table>`
      : "";

  const rows = items
    .map((it, i) => {
      const zebra = i % 2 ? "#ffffff" : "#f9fbfc";
      return `<tr>
          <td style="padding:12px 16px;background:${zebra};border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK};vertical-align:top;">${escapeHtml(
            it.label,
          )}${
            it.remarks
              ? `<div style="margin-top:4px;font-size:12px;color:${MUTED};">ملاحظة: ${escapeHtml(it.remarks)}</div>`
              : ""
          }</td>
          <td style="padding:12px 16px;background:${zebra};border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${NAVY};font-weight:700;white-space:nowrap;vertical-align:top;text-align:left;direction:ltr;">${escapeHtml(
            it.value,
          )}</td>
        </tr>`;
    })
    .join("");

  const content = `
    ${greeting(employeeName)}
    ${para(
      `تم اعتماد تقييم أدائك <strong>«${escapeHtml(templateTitle)}»</strong> بتاريخ ${iso(
        dateStr,
      )}. فيما يلي ملخّص النتيجة والتفاصيل.`,
    )}
    ${scoreBlock}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${LINE};border-radius:12px;overflow:hidden;border-collapse:separate;">
      <tr>
        <td style="padding:11px 16px;background:${NAVY};color:#ffffff;font-family:${FONT};font-size:13px;font-weight:700;">البند</td>
        <td style="padding:11px 16px;background:${NAVY};color:#ffffff;font-family:${FONT};font-size:13px;font-weight:700;text-align:left;">التقييم</td>
      </tr>
      ${rows || `<tr><td colspan="2" style="padding:14px 16px;font-family:${FONT};font-size:14px;color:${MUTED};">لا توجد بنود مفصّلة.</td></tr>`}
    </table>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.8;color:${MUTED};font-family:${FONT};">نسخة رسمية من هذا التقييم مرفقة بصيغة PDF مع هذه الرسالة.</p>`;

  return {
    subject: `نتيجة تقييم الأداء${score != null ? ` (${score}/100)` : ""} — ${templateTitle}`,
    html: shell({
      preheader: `تم اعتماد تقييم أدائك «${templateTitle}»${score != null ? ` بنتيجة ${score}/100` : ""}.`,
      eyebrow: "نتيجة تقييم",
      accent,
      title: "نتيجة تقييم الأداء الوظيفي",
      content,
    }),
    text:
      `مرحبًا ${employeeName}،\nتم اعتماد تقييم أدائك «${templateTitle}» بتاريخ ${dateStr}.` +
      (score != null ? `\nالنتيجة الإجمالية: ${score} / 100` : "") +
      "\n\n" +
      items
        .map((it) => `- ${it.label}: ${it.value}${it.remarks ? ` (ملاحظة: ${it.remarks})` : ""}`)
        .join("\n"),
  };
}
