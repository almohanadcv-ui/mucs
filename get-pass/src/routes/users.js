import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { audit } from '../services/audit.js';
import { encryptPw, decryptPw } from '../utils/secret.js';
import { getEffectivePermissions, permissionCatalog } from '../services/permissions.js';

const router = Router();
router.use(authenticate);

// قائمة المستخدمين (للإدارة) — تتضمن كلمة المرور للدعم
router.get('/', authorize('support', 'supervisor', 'manage_users'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.phone, u.national_id, u.is_active, u.pw_enc,
           r.code AS role, r.name_ar AS role_name, u.last_login_at, u.last_activity_at, u.created_at
    FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC
  `).all().map((u) => ({
    ...u,
    password: req.user.role === 'support' ? (u.pw_enc ? decryptPw(u.pw_enc) : null) : null,
    pw_enc: undefined,
  }));
  res.json({ rows });
});

// قائمة الأدوار
router.get('/roles', authorize('support', 'manage_roles'), (req, res) => {
  res.json({ rows: db.prepare(`SELECT * FROM roles ORDER BY id`).all() });
});

// قائمة التعهّدات الموقّعة (الدعم + المشرف) — الاسم + التاريخ + التوقيع
router.get('/undertakings', authorize('support', 'supervisor', 'supervise_applicants'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.undertaking_name, u.undertaking_signature, u.undertaking_accepted_at
    FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code='applicant' AND u.undertaking_accepted_at IS NOT NULL
    ORDER BY u.undertaking_accepted_at DESC
  `).all();
  res.json({ rows });
});

router.get('/performance', authorize('support', 'supervisor', 'supervise_applicants'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.is_active, u.last_login_at, u.last_activity_at,
      COUNT(r.id) total_requests,
      SUM(CASE WHEN date(r.submitted_at)=date('now') THEN 1 ELSE 0 END) daily_requests,
      SUM(CASE WHEN strftime('%Y-%m', r.submitted_at)=strftime('%Y-%m','now') THEN 1 ELSE 0 END) monthly_requests,
      MAX(r.submitted_at) last_request_at
    FROM users u
    JOIN roles role ON role.id=u.role_id AND role.code='applicant'
    LEFT JOIN permit_requests r ON r.created_by=u.id
    GROUP BY u.id
    ORDER BY total_requests DESC, u.created_at DESC
  `).all();
  res.json({ rows });
});

router.get('/permissions/catalog', authorize('support', 'manage_permissions'), (req, res) => {
  res.json({ rows: permissionCatalog() });
});

router.get('/:id/permissions', authorize('support', 'manage_permissions'), (req, res) => {
  const user = db.prepare(`SELECT id FROM users WHERE id=?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  const explicit = db.prepare(`SELECT permission_code FROM user_permissions WHERE user_id=? AND allowed=1`).all(req.params.id).map((r) => r.permission_code);
  res.json({ effective: getEffectivePermissions(req.params.id), explicit });
});

router.put('/:id/permissions', authorize('support', 'manage_permissions'), (req, res) => {
  const user = db.prepare(`SELECT id FROM users WHERE id=?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  const known = new Set(permissionCatalog().map((p) => p.code));
  const clean = [...new Set(permissions.filter((p) => known.has(p)))];
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM user_permissions WHERE user_id=?`).run(req.params.id);
    const ins = db.prepare(`INSERT INTO user_permissions(user_id, permission_code, allowed) VALUES(?,?,1)`);
    for (const p of clean) ins.run(req.params.id, p);
  });
  tx();
  audit({ req, action: 'UPDATE_PERMISSIONS', entityType: 'user', entityId: req.params.id, newValue: { permissions: clean } });
  res.json({ ok: true, effective: getEffectivePermissions(req.params.id), explicit: clean });
});

// إنشاء مستخدم
router.post('/', authorize('support', 'manage_users'), asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;
  if (!full_name || !email || !password || !role) throw httpError(400, 'كل الحقول الأساسية مطلوبة.');
  const roleRow = db.prepare(`SELECT id FROM roles WHERE code=?`).get(role);
  if (!roleRow) throw httpError(400, 'الدور غير صحيح.');
  if (db.prepare(`SELECT 1 FROM users WHERE email=?`).get(email.toLowerCase()))
    throw httpError(409, 'البريد مستخدم مسبقاً.');

  const id = randomUUID();
  db.prepare(`
    INSERT INTO users(id, full_name, email, phone, password_hash, pw_enc, role_id)
    VALUES(?,?,?,?,?,?,?)
  `).run(id, full_name, email.toLowerCase(), phone || null, bcrypt.hashSync(password, 10), encryptPw(password), roleRow.id);
  audit({ req, action: 'CREATE_USER', entityType: 'user', entityId: id, newValue: { email, role } });
  res.status(201).json({ id });
}));

// عرض كلمة المرور الحالية (الدعم فقط)
router.get('/:id/password', authorize('support'), asyncHandler(async (req, res) => {
  const user = db.prepare(`SELECT pw_enc FROM users WHERE id=?`).get(req.params.id);
  if (!user) throw httpError(404, 'المستخدم غير موجود.');
  audit({ req, action: 'VIEW_PASSWORD', entityType: 'user', entityId: req.params.id });
  res.json({ password: user.pw_enc ? decryptPw(user.pw_enc) : null });
}));

// تغيير/إعادة تعيين كلمة مرور مستخدم (الدعم)
router.post('/:id/password', authorize('support'), asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) throw httpError(400, 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
  const user = db.prepare(`SELECT id, email FROM users WHERE id=?`).get(req.params.id);
  if (!user) throw httpError(404, 'المستخدم غير موجود.');
  db.prepare(`UPDATE users SET password_hash=?, pw_enc=?, updated_at=datetime('now') WHERE id=?`)
    .run(bcrypt.hashSync(password, 10), encryptPw(password), user.id);
  audit({ req, action: 'RESET_PASSWORD', entityType: 'user', entityId: user.id });
  res.json({ ok: true });
}));

// حذف مستخدم نهائياً (الدعم) — بضوابط أمان
router.delete('/:id', authorize('support'), asyncHandler(async (req, res) => {
  const user = db.prepare(`SELECT u.id, u.email, r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(req.params.id);
  if (!user) throw httpError(404, 'المستخدم غير موجود.');
  if (user.id === req.user.id) throw httpError(400, 'لا يمكنك حذف حسابك.');
  if (user.role === 'support') {
    const supportCount = db.prepare(`SELECT COUNT(*) c FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='support' AND u.is_active=1`).get().c;
    if (supportCount <= 1) throw httpError(400, 'لا يمكن حذف آخر حساب دعم في النظام.');
  }
  // لا نحذف المستخدم الذي أنشأ طلبات (للحفاظ على سجل التدقيق) — نكتفي بتعطيله
  const hasReqs = db.prepare(`SELECT 1 FROM permit_requests WHERE created_by=? LIMIT 1`).get(user.id);
  if (hasReqs) {
    db.prepare(`UPDATE users SET is_active=0, session_id=NULL WHERE id=?`).run(user.id);
    audit({ req, action: 'DEACTIVATE_USER_KEEP', entityType: 'user', entityId: user.id });
    return res.json({ ok: true, deactivated: true });
  }
  db.prepare(`DELETE FROM users WHERE id=?`).run(user.id);
  audit({ req, action: 'DELETE_USER', entityType: 'user', entityId: user.id, oldValue: { email: user.email, role: user.role } });
  res.json({ ok: true, deleted: true });
}));

// تفعيل/تعطيل مستخدم
router.post('/:id/toggle', authorize('support'), asyncHandler(async (req, res) => {
  const user = db.prepare(`SELECT id, is_active FROM users WHERE id=?`).get(req.params.id);
  if (!user) throw httpError(404, 'المستخدم غير موجود.');
  if (user.id === req.user.id) throw httpError(400, 'لا يمكنك تعطيل حسابك.');
  const next = user.is_active ? 0 : 1;
  db.prepare(`UPDATE users SET is_active=?, updated_at=datetime('now') WHERE id=?`).run(next, user.id);
  audit({ req, action: 'TOGGLE_USER', entityType: 'user', entityId: user.id, newValue: { is_active: next } });
  res.json({ ok: true, is_active: next });
}));

export default router;
