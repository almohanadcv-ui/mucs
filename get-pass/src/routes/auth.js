import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { signToken, verifyMagic, signPending, verifyPending } from '../utils/jwt.js';
import { sendMail, otpEmail } from '../services/mailer.js';
import { getUndertaking, getRenewalWindowDays } from '../services/settings.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { validateNationalId } from '../utils/nationalId.js';
import { config } from '../config.js';
import { getEffectivePermissions } from '../services/permissions.js';

const router = Router();

const findByEmail = db.prepare(`
  SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=?
`);

// الكوكي: آمن (Secure) تلقائياً عند HTTPS فقط، وعادي عند http (مع trust proxy + X-Forwarded-Proto)
function cookieOpts(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!req.secure,
    maxAge: 8 * 60 * 60 * 1000,
  };
}

// ينشئ جلسة ويردّ ببيانات المستخدم (يُستخدم بعد نجاح الدخول أو التحقّق الثنائي)
function issueSession(req, res, user) {
  const sid = randomUUID(); // جلسة واحدة فعّالة: دخول جديد يُلغي السابق
  db.prepare(`UPDATE users SET session_id=?, last_login_at=datetime('now'), last_activity_at=datetime('now') WHERE id=?`).run(sid, user.id);
  const token = signToken({ id: user.id, role: user.role, sid });
  res.cookie('token', token, cookieOpts(req));
  audit({ req, actor: user, action: 'LOGIN', entityType: 'user', entityId: user.id });
  res.json({ token, user: publicUser(user) });
}

function publicUser(user) {
  const fresh = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.national_id, u.undertaking_accepted_at,
           u.tour_completed_at, u.last_login_at, r.code AS role
    FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
  `).get(user.id) || user;
  return {
    id: fresh.id,
    full_name: fresh.full_name,
    email: fresh.email,
    role: fresh.role,
    national_id: fresh.national_id,
    permissions: getEffectivePermissions(fresh.id),
    needs_undertaking: fresh.role === 'applicant' && !fresh.undertaking_accepted_at,
    undertaking_accepted_at: fresh.undertaking_accepted_at,
    tour_completed_at: fresh.tour_completed_at,
    needs_tour: ['applicant', 'reviewer', 'supervisor', 'general_management'].includes(fresh.role) && !fresh.tour_completed_at,
    renewalWindowDays: getRenewalWindowDays(),
  };
}

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
async function sendOtp(user) {
  const code = genCode();
  db.prepare(`DELETE FROM login_otps WHERE user_id=?`).run(user.id);
  db.prepare(`INSERT INTO login_otps(id, user_id, code_hash, expires_at) VALUES(?,?,?,?)`)
    .run(randomUUID(), user.id, bcrypt.hashSync(code, 8), new Date(Date.now() + 10 * 60000).toISOString());
  await sendMail({ to: user.email, ...otpEmail(code) });
}

// تسجيل الدخول — خطوة 1: تحقّق كلمة المرور (ثم رمز بريد إن كان التحقّق الثنائي مفعّلاً)
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'البريد وكلمة المرور مطلوبان.');

  const user = findByEmail.get(String(email).trim().toLowerCase());
  const ok = user && user.is_active && bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    audit({ req, actor: { id: null, full_name: email }, action: 'LOGIN_FAILED', entityType: 'user', entityId: user?.id });
    throw httpError(401, 'بيانات الدخول غير صحيحة.');
  }

  // التحقّق الثنائي عبر البريد (إن كان مفعّلاً ومضبوطاً)
  if (config.loginOtpEnabled && config.smtp.host) {
    try { await sendOtp(user); }
    catch (e) { console.error('إرسال OTP:', e?.message || e); throw httpError(500, 'تعذّر إرسال رمز التحقق — تحقّق من إعدادات البريد.'); }
    audit({ req, actor: user, action: 'LOGIN_OTP_SENT', entityType: 'user', entityId: user.id });
    return res.json({ step: 'otp', pending: signPending(user.id), email: user.email.replace(/^(.).*(@.*)$/, '$1***$2') });
  }

  issueSession(req, res, user);
}));

// تسجيل الدخول — خطوة 2: تأكيد رمز البريد
router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { pending, code } = req.body;
  if (!pending || !code) throw httpError(400, 'الرمز مطلوب.');
  let d; try { d = verifyPending(pending); } catch { throw httpError(401, 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.'); }
  const row = db.prepare(`SELECT * FROM login_otps WHERE user_id=? ORDER BY created_at DESC LIMIT 1`).get(d.id);
  if (!row) throw httpError(400, 'لا يوجد رمز فعّال. أعد الدخول.');
  if (new Date(row.expires_at) < new Date()) throw httpError(400, 'انتهت صلاحية الرمز. أعد الدخول.');
  if (row.attempts >= 5) throw httpError(429, 'محاولات كثيرة. أعد الدخول.');
  if (!bcrypt.compareSync(String(code).trim(), row.code_hash)) {
    db.prepare(`UPDATE login_otps SET attempts=attempts+1 WHERE id=?`).run(row.id);
    throw httpError(401, 'رمز غير صحيح.');
  }
  db.prepare(`DELETE FROM login_otps WHERE user_id=?`).run(d.id);
  const user = db.prepare(`SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(d.id);
  if (!user || !user.is_active) throw httpError(401, 'الحساب غير صالح أو معطّل.');
  issueSession(req, res, user);
}));

// إعادة إرسال الرمز
router.post('/resend-otp', asyncHandler(async (req, res) => {
  const { pending } = req.body;
  let d; try { d = verifyPending(pending); } catch { throw httpError(401, 'انتهت الصلاحية. سجّل الدخول من جديد.'); }
  const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(d.id);
  if (!user) throw httpError(404, 'المستخدم غير موجود.');
  try { await sendOtp(user); } catch (e) { throw httpError(500, 'تعذّر إرسال الرمز.'); }
  res.json({ ok: true });
}));

// دخول مباشر عبر رابط واتساب (passwordless): يتحقّق من التوكن، ينشئ جلسة، ثم يحوّل للموقع.
router.get('/magic/:token', asyncHandler(async (req, res) => {
  let decoded;
  try { decoded = verifyMagic(req.params.token); }
  catch {
    audit({ req, action: 'LOGIN_MAGIC_FAILED', entityType: 'user' });
    return res.status(401).send('<html dir="rtl"><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px"><h3>انتهت صلاحية الرابط أو غير صالح.</h3><p>اطلب رابطاً جديداً من الوكيل.</p></body></html>');
  }
  const user = db.prepare(`SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(decoded.id);
  if (!user || !user.is_active) return res.status(401).send('<html dir="rtl"><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px"><h3>الحساب غير صالح أو معطّل.</h3></body></html>');

  const sid = randomUUID();
  db.prepare(`UPDATE users SET session_id=? WHERE id=?`).run(sid, user.id);
  const token = signToken({ id: user.id, role: user.role, sid });
  res.cookie('token', token, cookieOpts(req));
  audit({ req, actor: user, action: 'LOGIN_MAGIC', entityType: 'user', entityId: user.id });
  res.redirect('/?m=1'); // العلم m=1 يخبر الواجهة أن تُبقي الجلسة (لا خروج تلقائي)
}));

// ملاحظة: التسجيل الذاتي معطّل — حسابات المقدّمين يُنشئها الدعم فقط.

// من أنا
router.get('/me', authenticate, (req, res) => {
  db.prepare(`UPDATE users SET last_activity_at=datetime('now') WHERE id=?`).run(req.user.id);
  res.json({ user: publicUser(req.user) });
});

// نص التعهّد القابل للتعديل (يقرؤه مقدّم الطلب قبل التوقيع)
router.get('/undertaking-text', authenticate, (req, res) => res.json(getUndertaking()));

router.post('/undertaking', authenticate, (req, res) => {
  if (req.user.role !== 'applicant') return res.status(400).json({ error: 'التعهد مطلوب لمقدمي الطلبات فقط.' });
  const { full_name, signed_at, signature } = req.body || {};
  if (!full_name || !signature) return res.status(400).json({ error: 'الاسم والتوقيع الإلكتروني مطلوبان.' });
  const key = `undertaking-${req.user.id}-${Date.now()}.pdf`;
  db.prepare(`
    UPDATE users SET undertaking_accepted_at=datetime('now'), undertaking_pdf_key=?,
      undertaking_signature=?, undertaking_name=?, last_activity_at=datetime('now')
    WHERE id=?
  `).run(key, signature, full_name, req.user.id);
  audit({ req, action: 'ACCEPT_UNDERTAKING', entityType: 'user', entityId: req.user.id, newValue: { full_name, signed_at, pdf: key } });
  res.json({ ok: true, pdf: key, user: publicUser(req.user) });
});

router.post('/tour-complete', authenticate, (req, res) => {
  db.prepare(`UPDATE users SET tour_completed_at=datetime('now'), last_activity_at=datetime('now') WHERE id=?`).run(req.user.id);
  audit({ req, action: 'COMPLETE_TOUR', entityType: 'user', entityId: req.user.id });
  res.json({ ok: true, user: publicUser(req.user) });
});

// خروج
router.post('/logout', (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) { const d = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); if (d?.id) db.prepare(`UPDATE users SET session_id=NULL WHERE id=?`).run(d.id); }
  } catch {}
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
