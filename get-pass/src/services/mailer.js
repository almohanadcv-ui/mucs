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

/** قالب بريد رمز الدخول. */
export function otpEmail(code) {
  return {
    subject: `رمز الدخول: ${code} — نظام التصاريح MAB`,
    text: `رمز الدخول الخاص بك: ${code} (صالح لمدة 10 دقائق).`,
    html: `<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;max-width:480px;margin:auto;padding:10px">
      <h2 style="color:#2563EB;margin:0 0 8px">نظام التصاريح — MAB</h2>
      <p style="color:#334155">رمز الدخول الخاص بك:</p>
      <div style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#f1f5f9;padding:18px;text-align:center;border-radius:12px;color:#0f172a">${code}</div>
      <p style="color:#64748b;font-size:13px;margin-top:14px">صالح لمدة 10 دقائق. إذا لم تطلب الدخول فتجاهل هذه الرسالة.</p>
    </div>`,
  };
}
