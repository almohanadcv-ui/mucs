/*
 * mailer.js — إرسال البريد عبر SMTP (Hostinger أو أي مزوّد) باستخدام nodemailer.
 * يُحمّل nodemailer ديناميكياً حتى لا يتعطّل الخادم إن لم تُثبّت المكتبة بعد.
 */
import { config } from '../config.js';

let tx = null;
export async function sendMail({ to, subject, html, text }) {
  if (!config.smtp.host || !config.smtp.user) throw new Error('SMTP غير مضبوط في .env');
  const nodemailer = (await import('nodemailer')).default;
  if (!tx) {
    tx = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // 465 = SSL، 587 = STARTTLS
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return tx.sendMail({ from: config.smtp.from || config.smtp.user, to, subject, html, text });
}

// ── هوية النظام في البريد ─────────────────────────────────────────────────────
const BRAND = 'نظام التصاريح — MAB';
const NAVY = '#0f2b46';
const INK = '#1f2a37';
const MUTED = '#64748b';
const LINE = '#e6eaf0';
const CANVAS = '#eef1f5';
const FONT = "'Segoe UI',Tahoma,'Helvetica Neue',Arial,sans-serif";

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * قالب مشترك موحّد بين كل الأنظمة (RTL، أنماط مضمّنة). كل نظام باسمه عبر BRAND.
 */
function shell({ preheader, eyebrow, accent, title, content }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /></head>
  <body style="margin:0;padding:0;background:${CANVAS};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr><td align="center" style="padding:28px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};box-shadow:0 4px 16px rgba(15,43,70,.08);">
          <tr><td style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,#173a5e 100%);padding:26px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:20px;font-weight:800;font-family:${FONT};">${esc(BRAND)}</div>
          </td></tr>
          <tr><td style="padding:32px;font-family:${FONT};">
            <span style="display:inline-block;background:${accent}1a;color:${accent};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${esc(eyebrow)}</span>
            <h1 style="margin:16px 0 18px;font-size:21px;line-height:1.5;color:${NAVY};font-weight:700;">${esc(title)}</h1>
            ${content}
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f7f9fb;border-top:1px solid ${LINE};font-family:${FONT};">
            <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.7;text-align:center;">رسالة آلية من ${esc(BRAND)} — الرجاء عدم الرد عليها.<br />© ${year} MAB United. جميع الحقوق محفوظة.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function para(html) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:${INK};">${html}</p>`;
}

function button(href, label, color) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${color};">
    <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
  </td></tr></table>`;
}

/** قالب بريد رمز الدخول — موحّد مع بقية الأنظمة. */
export function otpEmail(code, name) {
  const accent = '#2563eb';
  const content = `
    ${para(name ? `مرحبًا ${esc(name)} 👋 كيف حالك؟` : 'مرحبًا 👋 كيف حالك؟')}
    ${para('هذا هو <strong>رمز التحقق</strong> الخاص بك لتسجيل الدخول:')}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;width:100%;"><tr><td align="center">
      <div style="display:inline-block;background:#f1f5fb;border:1px solid #dbe4f0;border-radius:12px;padding:16px 30px;font-family:'Segoe UI',Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:${NAVY};direction:ltr;">${esc(code)}</div>
    </td></tr></table>
    ${para(`<span style="color:${MUTED};font-size:13px;">الرمز صالح لمدة <strong>10 دقائق</strong> ويُستخدم مرة واحدة. لا تُشاركه مع أحد — لن يطلبه منك أي أحد من فريق العمل. وإن لم تكن أنت من حاول الدخول، تجاهل هذه الرسالة بأمان.</span>`)}
    ${para('نتمنى لك يومًا رائعًا ✨')}
    <p style="margin:18px 0 0;font-size:14px;line-height:1.9;color:${INK};">تحيّاتنا،<br /><strong>قسم تقنية المعلومات (IT)</strong></p>`;
  return {
    subject: `${code} is your verification code — ${BRAND}`,
    text: `مرحبًا${name ? ' ' + name : ''} 👋 كيف حالك؟\n\nرمز التحقق الخاص بك: ${code}\nصالح لمدة 10 دقائق ويُستخدم مرة واحدة.\n\nنتمنى لك يومًا رائعًا ✨\nقسم تقنية المعلومات (IT)`,
    html: shell({
      preheader: `Your verification code is ${code}. It is valid for 10 minutes.`,
      eyebrow: 'رمز التحقق',
      accent,
      title: 'رمز تسجيل الدخول',
      content,
    }),
  };
}

/** قالب بريد إعادة تعيين كلمة المرور — موحّد مع بقية الأنظمة. */
export function passwordResetEmail(link, name) {
  const accent = '#2563eb';
  const content = `
    ${para(name ? `مرحبًا ${esc(name)}،` : 'مرحبًا،')}
    ${para('وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط الزر التالي لتعيين كلمة مرور جديدة:')}
    ${button(link, 'إعادة تعيين كلمة المرور', accent)}
    ${para(`<span style="color:${MUTED};font-size:13px;">هذا الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة. إن لم تطلب ذلك، تجاهل هذه الرسالة وكلمة مرورك تبقى كما هي.</span>`)}
    ${para(`<span style="color:${MUTED};font-size:12px;">إن لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفّح:<br /><span dir="ltr" style="word-break:break-all;color:${accent};">${esc(link)}</span></span>`)}
    <p style="margin:18px 0 0;font-size:14px;line-height:1.9;color:${INK};">تحيّاتنا،<br /><strong>قسم تقنية المعلومات (IT)</strong></p>`;
  return {
    subject: `إعادة تعيين كلمة المرور — ${BRAND}`,
    text: `مرحبًا${name ? ' ' + name : ''}،\nلإعادة تعيين كلمة مرورك افتح الرابط (صالح 30 دقيقة):\n${link}\nإن لم تطلب ذلك فتجاهل هذه الرسالة.`,
    html: shell({
      preheader: 'رابط إعادة تعيين كلمة مرور حسابك (صالح لـ30 دقيقة).',
      eyebrow: 'إعادة تعيين',
      accent,
      title: 'إعادة تعيين كلمة المرور',
      content,
    }),
  };
}
