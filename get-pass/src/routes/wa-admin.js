/*
 * wa-admin.js — إدارة منصّة واتساب — الدفعتان 1 و 2
 * ------------------------------------------------
 * ربط الأرقام، متابعة الطابور، رفع مستند اختباري، عرض الحزم، وقرار المراجِع (YES/NO).
 * مسارات جديدة معزولة (/api/wa) — لا تمسّ أي API قائم.
 */
import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { audit } from '../services/audit.js';
import { addLink, removeLink, listLinks, resolveUserId } from '../services/wa/linking.js';
import { enqueue } from '../services/wa/queue.js';
import { createFromPackage } from '../services/wa/requestCreator.js';
import { runHourlyExport } from '../services/wa/exporter.js';
import { runDistribution } from '../services/wa/distributor.js';
import { publicSettings, setSetting } from '../services/settings.js';

const router = Router();
router.use(authenticate);
const support = authorize('support');
const staff = authorize('support', 'reviewer');
// صفحة الإعدادات (الإعدادات + ربط الأرقام + المهندسين) — تقبل صلاحية الإعدادات
const settingsAuth = authorize('support', 'manage_settings', 'manage_whatsapp');

// ===== ربط الأرقام (دعم / إدارة الإعدادات) =====
router.get('/links', settingsAuth, (req, res) => res.json({ rows: listLinks() }));
router.post('/links', settingsAuth, asyncHandler(async (req, res) => {
  const wa_id = String(req.body.wa_id || '').trim();
  const user_id = String(req.body.user_id || '').trim();
  const label = req.body.label ? String(req.body.label).trim() : null;
  if (!wa_id || !user_id) throw httpError(400, 'wa_id و user_id مطلوبان.');
  if (!db.prepare(`SELECT 1 FROM users WHERE id=?`).get(user_id)) throw httpError(400, 'المستخدم غير موجود.');
  addLink(wa_id, user_id, label);
  audit({ req, action: 'WA_LINK', entityType: 'wa_link', entityId: wa_id, newValue: { user_id, label } });
  res.json({ ok: true });
}));
router.delete('/links/:waId', settingsAuth, asyncHandler(async (req, res) => {
  const n = removeLink(req.params.waId);
  audit({ req, action: 'WA_UNLINK', entityType: 'wa_link', entityId: req.params.waId });
  res.json({ ok: true, removed: n });
}));

// ===== إعدادات النظام (دعم) — تُحفظ في قاعدة البيانات ويقرأها الكود مباشرة =====
router.get('/settings', settingsAuth, (req, res) => res.json(publicSettings()));
router.put('/settings', settingsAuth, asyncHandler(async (req, res) => {
  const { exportBatchSize, reviewerIds, allowlist, exportRecipients, undertakingTitle, undertakingBody, submitStart, submitEnd, renewalWindowDays } = req.body || {};
  if (exportBatchSize != null) {
    const n = Number(exportBatchSize);
    if (!Number.isFinite(n) || n < 1) throw httpError(400, 'عتبة التصدير يجب أن تكون رقماً ≥ 1.');
    setSetting('exportBatchSize', String(Math.floor(n)));
  }
  if (reviewerIds != null) setSetting('reviewerIds', String(reviewerIds));
  if (allowlist != null) setSetting('allowlist', String(allowlist));
  if (exportRecipients != null) setSetting('exportRecipients', String(exportRecipients));
  if (undertakingTitle != null) setSetting('undertaking_title', String(undertakingTitle));
  if (undertakingBody != null) setSetting('undertaking_body', String(undertakingBody));
  const timeOk = (s) => /^\d{1,2}:\d{2}$/.test(String(s || ''));
  if (submitStart != null && timeOk(submitStart)) setSetting('submit_start', String(submitStart));
  if (submitEnd != null && timeOk(submitEnd)) setSetting('submit_end', String(submitEnd));
  if (renewalWindowDays != null) { const n = Number(renewalWindowDays); if (Number.isFinite(n) && n >= 1) setSetting('renewal_window_days', String(Math.floor(n))); }
  audit({ req, action: 'WA_SETTINGS_UPDATE', entityType: 'settings', newValue: publicSettings() });
  res.json({ ok: true, ...publicSettings() });
}));

// ===== عارض قاعدة البيانات (دعم) — للقراءة فقط =====
router.get('/db/tables', support, (req, res) => {
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map((r) => r.name);
  res.json({ tables });
});
router.get('/db/table/:name', support, asyncHandler(async (req, res) => {
  const name = String(req.params.name);
  // التحقّق من اسم الجدول مقابل القائمة الفعلية (whitelist) قبل أي استعلام — أمان من الحقن
  const ok = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  if (!ok) throw httpError(404, 'جدول غير موجود.');
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const count = db.prepare(`SELECT COUNT(*) c FROM "${name}"`).get().c;
  const rows = db.prepare(`SELECT * FROM "${name}" LIMIT ${limit}`).all();
  const columns = rows.length ? Object.keys(rows[0]) : db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
  res.json({ name, count, columns, rows });
}));

// قائمة المهندسين (المقدّمين) — لقائمة الربط في صفحة الإعدادات
router.get('/applicants', settingsAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code='applicant' AND u.is_active=1 ORDER BY u.full_name
  `).all();
  res.json({ rows });
});

// ===== متابعة الطابور (موظفون) =====
router.get('/jobs', staff, (req, res) => {
  const rows = db.prepare(`SELECT id, type, status, attempts, max_attempts, last_error, run_after, created_at, updated_at FROM wa_jobs ORDER BY created_at DESC LIMIT 100`).all();
  const counts = db.prepare(`SELECT status, COUNT(*) c FROM wa_jobs GROUP BY status`).all();
  res.json({ counts: Object.fromEntries(counts.map((x) => [x.status, x.c])), rows });
});
router.post('/test-enqueue', support, (req, res) => {
  const id = enqueue('wa.echo', { text: req.body?.text || 'hello-from-pams' });
  res.json({ ok: true, job_id: id });
});

// ===== رفع مستند للمعالجة (مدخل اختبار للدفعة 2 — يحاكي وصول ملف من واتساب) =====
router.post('/doc', support, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'أرفق ملفاً باسم "file".');
  const fromId = String(req.body.from_id || '').replace(/\D/g, '') || null;
  const userId = fromId ? resolveUserId(fromId) : null;
  const docId = randomUUID();
  db.prepare(`INSERT INTO wa_documents(id, from_id, user_id, storage_key, mime_type, status) VALUES(?,?,?,?,?, 'received')`)
    .run(docId, fromId, userId, path.basename(req.file.path), req.file.mimetype);
  audit({ req, action: 'WA_DOC_RECEIVED', entityType: 'wa_document', entityId: docId, newValue: { from_id: fromId, user_id: userId } });
  const jobId = enqueue('wa.doc', { documentId: docId });
  res.json({ ok: true, document_id: docId, job_id: jobId, linked_user: userId });
}));

// ===== الحزم (موظفون) =====
router.get('/packages', staff, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, u.full_name AS engineer,
      (SELECT COUNT(*) FROM wa_documents d WHERE d.package_id=p.id) AS docs
    FROM wa_packages p LEFT JOIN users u ON u.id=p.user_id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
  res.json({ rows });
});
router.get('/packages/:id', staff, (req, res) => {
  const pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(req.params.id);
  if (!pkg) throw httpError(404, 'الحزمة غير موجودة.');
  const docs = db.prepare(`SELECT id, kind, national_id, confidence, status, created_at FROM wa_documents WHERE package_id=?`).all(pkg.id);
  res.json({ package: pkg, documents: docs });
});

// ===== قرار المراجِع (YES/NO) — المسار (ب) =====
router.post('/packages/:id/decide', staff, asyncHandler(async (req, res) => {
  const pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(req.params.id);
  if (!pkg) throw httpError(404, 'الحزمة غير موجودة.');
  if (pkg.status !== 'ready') throw httpError(409, `لا يمكن اتخاذ قرار على حزمة حالتها "${pkg.status}".`);
  const decision = String(req.body.decision || '').toLowerCase();

  if (decision === 'yes') {
    const r = createFromPackage(pkg.id, req.user.id, { nationalId: req.body.national_id, idType: req.body.id_type });
    audit({ req, action: 'WA_DECIDE_YES', entityType: 'wa_package', entityId: pkg.id, newValue: r });
    return res.json(r.ok ? { ok: true, decision: 'yes', ...r } : { ok: false, decision: 'yes', reason: r.reason });
  }
  if (decision === 'no') {
    db.prepare(`UPDATE wa_packages SET status='blocked', reason='رفض المراجِع', updated_at=datetime('now') WHERE id=?`).run(pkg.id);
    audit({ req, action: 'WA_DECIDE_NO', entityType: 'wa_package', entityId: pkg.id });
    return res.json({ ok: true, decision: 'no', status: 'blocked' });
  }
  throw httpError(400, 'decision يجب أن تكون yes أو no.');
}));

// ===== تشغيل التصدير الساعي يدوياً (اختبار/طلب فوري) =====
router.post('/run-export', staff, asyncHandler(async (req, res) => {
  const r = runHourlyExport();
  audit({ req, action: 'WA_EXPORT_MANUAL', entityType: 'request', newValue: r });
  res.json({ ok: true, ...r });
}));

// ===== التوزيع: عرض السجل + تشغيل يدوي =====
router.get('/distributions', staff, (req, res) => {
  const rows = db.prepare(`
    SELECT d.permit_id, d.permit_number, d.request_number, d.status, d.attempts, d.sent_at, d.error, u.full_name AS engineer
    FROM wa_distributions d LEFT JOIN users u ON u.id=d.engineer_user_id
    ORDER BY d.created_at DESC LIMIT 100
  `).all();
  const counts = db.prepare(`SELECT status, COUNT(*) c FROM wa_distributions GROUP BY status`).all();
  res.json({ counts: Object.fromEntries(counts.map((x) => [x.status, x.c])), rows });
});
router.post('/run-distribute', staff, asyncHandler(async (req, res) => {
  const r = await runDistribution();
  res.json({ ok: true, ...r });
}));

// ===== لوحة التشغيل (الدفعة 5) =====
router.get('/dashboard', authorize('support', 'reviewer', 'view_system_health'), (req, res) => {
  const grp = (sql) => Object.fromEntries(db.prepare(sql).all().map((r) => [r.k, r.c]));
  const one = (sql) => db.prepare(sql).get().c;
  res.json({
    requests: grp(`SELECT status k, COUNT(*) c FROM permit_requests GROUP BY status`),
    permits: grp(`SELECT status k, COUNT(*) c FROM permits GROUP BY status`),
    packages: grp(`SELECT status k, COUNT(*) c FROM wa_packages GROUP BY status`),
    distribution: grp(`SELECT status k, COUNT(*) c FROM wa_distributions GROUP BY status`),
    jobs: grp(`SELECT status k, COUNT(*) c FROM wa_jobs GROUP BY status`),
    ocr_failures: one(`SELECT COUNT(*) c FROM wa_documents WHERE status='no_id' OR (status='processed' AND national_id IS NULL)`),
    duplicates_blocked: one(`SELECT COUNT(*) c FROM wa_packages WHERE status='blocked'`),
    unlinked: one(`SELECT COUNT(*) c FROM wa_distributions WHERE status='unlinked'`),
    dead_jobs: one(`SELECT COUNT(*) c FROM wa_jobs WHERE status='dead'`),
  });
});

export default router;
