import nodemailer from 'nodemailer';
import { logInfo, logError } from './logger.js';

// Gmail App Password may be provided with or without spaces — normalize.
const normalizedPass = (process.env.MAIL_PASS || '').replace(/\s+/g, '');
const fromAddress = process.env.MAIL_FROM;

const isEmailConfigured = Boolean(fromAddress && normalizedPass);

// Some hosts (Railway, Fly, certain cloud providers) block port 465 (SMTPS)
// outbound. Port 587 (STARTTLS) is much more reliable on cloud platforms.
// Override with MAIL_PORT in env if needed.
const SMTP_PORT = parseInt(process.env.MAIL_PORT, 10) || 587;
const SMTP_HOST = process.env.MAIL_HOST || 'smtp.gmail.com';
const SMTP_SECURE = SMTP_PORT === 465; // SSL only on 465; STARTTLS on 587

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: fromAddress,
        pass: normalizedPass,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 20,
      // Generous timeouts for cloud networks that throttle outbound SMTP
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    })
  : null;

// Pre-warm SMTP at boot so the FIRST email isn't 5 seconds slower.
if (transporter) {
  transporter.verify((err) => {
    if (err) {
      console.error('\n❌ [email] فشل التحقق من إعدادات Gmail SMTP:');
      console.error('   →', err.message);
      console.error('   تأكد من:');
      console.error('   1) MAIL_FROM يحتوي بريد Gmail صحيح');
      console.error('   2) MAIL_PASS هو App Password من https://myaccount.google.com/apppasswords');
      console.error('   3) ميزة 2FA مفعّلة على حساب Gmail');
      console.error('   4) لا يوجد فاصل/مسافة زائدة\n');
      logError({ event: 'smtp_verify_failed', error: err.message });
    } else {
      console.log(`✅ [email] Gmail SMTP جاهز — ${fromAddress} via ${SMTP_HOST}:${SMTP_PORT}`);
      logInfo({ event: 'smtp_ready', from: fromAddress, host: SMTP_HOST, port: SMTP_PORT });
    }
  });
} else {
  console.warn('⚠️  [email] MAIL_FROM/MAIL_PASS غير معرّفة في .env — لن يتم إرسال أي بريد.');
}

const fromName = process.env.MAIL_FROM_NAME || 'MAP UNITED IT';

// ─────────────────────────────────────────────────────────────
//  Shared template wrapper
// ─────────────────────────────────────────────────────────────
const buildEmailHtml = ({ greeting, body, code, footerNote }) => `
  <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:2rem;
                         background:#F4F8FF;border-radius:12px;border:1px solid #D0DCFF">
    <h2 style="color:#0A66FF;margin-bottom:.5rem">${greeting}</h2>
    <p style="color:#4B5E8A;line-height:1.7;margin-bottom:1.2rem">${body}</p>
    <div style="background:#fff;border:2px solid #0A66FF;border-radius:10px;
                padding:1rem;text-align:center;margin-bottom:1.2rem">
      <span style="font-family:monospace;font-size:1.5rem;font-weight:700;
                   color:#0A66FF;letter-spacing:.1em">${code}</span>
    </div>
    <p style="color:#EF4444;font-size:.85rem;margin-bottom:1rem">${footerNote}</p>
    <p style="color:#9BA8C0;font-size:.75rem">MAP UNITED — IT Help Desk</p>
  </div>`;

const sendMail = async ({ to, subject, html, eventTag }) => {
  if (!transporter) {
    logError({ event: 'email_skipped_no_config', to });
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ [email/${eventTag}] sent to ${to} | id: ${info.messageId}`);
    logInfo({ event: eventTag, to, messageId: info.messageId });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [email/${eventTag}] فشل الإرسال إلى ${to}: ${error.message}`);
    if (error.response) console.error('   SMTP response:', error.response);
    logError({ event: `${eventTag}_failed`, to, error: error.message, response: error.response });
    return { ok: false, reason: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
//  1) Account Activation Email — for NEW employees
// ─────────────────────────────────────────────────────────────
export async function sendActivationEmail(to, name, code) {
  const html = buildEmailHtml({
    greeting: `🎉 مرحباً ${name || ''}`,
    body: `تم تفعيل حسابك في نظام <b>MAP UNITED Help Desk</b> بنجاح!<br>
           يمكنك الآن تسجيل الدخول باستخدام الرمز المؤقت التالي:`,
    code,
    footerNote: '⚠️ يجب تغيير كلمة المرور عند أول دخول فوراً.',
  });

  return sendMail({
    to,
    subject: '🎉 تم تفعيل حسابك — MAP UNITED Help Desk',
    html,
    eventTag: 'email_activation',
  });
}

// ─────────────────────────────────────────────────────────────
//  2) Password Reset Email — for EXISTING users who forgot
// ─────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to, name, code) {
  const html = buildEmailHtml({
    greeting: `🔐 طلب استعادة كلمة المرور`,
    body: `مرحباً ${name || ''},<br>
           استلمنا طلباً لاستعادة كلمة مرور حسابك في <b>MAP UNITED Help Desk</b>.<br>
           استخدم الرمز التالي كـ "كلمة مرور" في صفحة تسجيل الدخول، ثم سيُطلب منك تعيين كلمة مرور جديدة:`,
    code,
    footerNote: '⚠️ إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذا البريد بأمان.',
  });

  return sendMail({
    to,
    subject: '🔐 رمز استعادة كلمة المرور — MAP UNITED Help Desk',
    html,
    eventTag: 'email_reset',
  });
}
