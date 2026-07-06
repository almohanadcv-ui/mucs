import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { buildXlsx } from '../utils/xlsx.js';
import { config } from '../config.js';

const router = Router();

// ---------------------------------------------------------------
// قائمة التصاريح (تصفية)
// ---------------------------------------------------------------
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, q, sort, dedupe } = req.query;
  const where = [];
  const params = {};
  if (req.user.role === 'applicant') {
    where.push('p.request_id IN (SELECT id FROM permit_requests WHERE created_by=@uid)');
    params.uid = req.user.id;
  }
  if (status) { where.push('p.status=@status'); params.status = status; }
  if (q) { where.push('(p.permit_number LIKE @q OR p.national_id LIKE @q OR p.holder_name LIKE @q)'); params.q = `%${q}%`; }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // نجلب مرتّبة بالأحدث إصداراً أولاً (ليكون أول تصريح لكل هوية هو الأحدث)
  let rows = db.prepare(`SELECT p.* FROM permits p ${whereSql} ORDER BY p.issued_at DESC, p.rowid DESC LIMIT 1000`).all(params);

  // عرض آخر تصريح فقط لكل هوية
  if (dedupe === '1') {
    const seen = new Set();
    rows = rows.filter((p) => (seen.has(p.national_id) ? false : (seen.add(p.national_id), true)));
  }

  // الفرز
  if (sort === 'expiry') rows.sort((a, b) => (a.valid_to < b.valid_to ? -1 : a.valid_to > b.valid_to ? 1 : 0));
  // (الافتراضي: الأحدث إصداراً — كما جُلبت)

  res.json({ rows: rows.slice(0, 300) });
}));

// حالة التجديد للمقدّم الحالي — كل التصاريح الفعّالة المقاربة للانتهاء (مرتّبة بالأقدم انتهاءً)
router.get('/renewal-status', authenticate, (req, res) => {
  const permits = db.prepare(`
    SELECT * FROM permits
    WHERE status='active' AND request_id IN (SELECT id FROM permit_requests WHERE created_by=?)
    ORDER BY valid_to ASC
  `).all(req.user.id);
  const items = permits.map((p) => ({
    permit_number: p.permit_number, holder_name: p.holder_name, national_id: p.national_id, valid_to: p.valid_to,
    daysLeft: Math.ceil((new Date(p.valid_to + 'T00:00:00Z') - new Date()) / 86400000),
  })).filter((p) => p.daysLeft <= config.renewalWindowDays);
  res.json({ expiring: items.length > 0, items });
});

// التصاريح المقاربة للانتهاء — للمراجِع/الدعم (تنبيه على الصفحة)
router.get('/expiring-soon', authenticate, authorize('reviewer', 'support'), (req, res) => {
  const limit = new Date(); limit.setDate(limit.getDate() + config.renewalWindowDays);
  const rows = db.prepare(`SELECT * FROM permits WHERE status='active' AND valid_to <= ? ORDER BY valid_to ASC`)
    .all(limit.toISOString().slice(0, 10));
  const items = rows.map((p) => ({
    id: p.id, permit_number: p.permit_number, holder_name: p.holder_name, national_id: p.national_id, valid_to: p.valid_to,
    daysLeft: Math.ceil((new Date(p.valid_to + 'T00:00:00Z') - new Date()) / 86400000),
  }));
  res.json({ expiring: items.length > 0, items });
});

// تصدير التصاريح إلى ملف Excel حقيقي (.xlsx)
router.get('/export.xlsx', authenticate, authorize('reviewer', 'support'), asyncHandler(async (req, res) => {
  const { status, q, ids } = req.query;
  const where = [];
  const params = {};

  // تصدير تصاريح محددة بالمعرّفات إن وُجدت، وإلا حسب الفلاتر
  const idList = (ids ? String(ids).split(',').map((s) => s.trim()).filter(Boolean) : []).slice(0, 1000);
  if (idList.length) {
    where.push(`p.id IN (${idList.map((_, i) => '@id' + i).join(',')})`);
    idList.forEach((v, i) => { params['id' + i] = v; });
  } else {
    if (status) { where.push('p.status=@status'); params.status = status; }
    if (q) { where.push('(p.permit_number LIKE @q OR p.national_id LIKE @q OR p.holder_name LIKE @q)'); params.q = `%${q}%`; }
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT p.*, r.id_type, r.sponsorship, r.sponsor_company, r.request_number
    FROM permits p LEFT JOIN permit_requests r ON r.id=p.request_id
    ${whereSql} ORDER BY p.issued_at DESC
  `).all(params);

  const ST = { active: 'Active', expired: 'Expired', cancelled: 'Cancelled' };
  const data = [[
    'Permit No', 'Holder Name', 'Document Type', 'ID / Iqama No', 'Sponsorship', 'Company Name',
    'Status', 'Valid From', 'Valid To', 'Issued On', 'Request No',
  ]];
  for (const p of rows) {
    data.push([
      p.permit_number, p.holder_name,
      p.id_type === 'iqama' ? 'Iqama' : 'National ID',
      p.national_id,
      p.sponsorship === 'other' ? 'Other Company' : 'MAB',
      p.sponsor_company || '',
      ST[p.status] || p.status,
      p.valid_from, p.valid_to, (p.issued_at || '').slice(0, 10), p.request_number || '',
    ]);
  }
  const widths = [18, 26, 14, 16, 14, 24, 12, 14, 14, 14, 18];
  const buf = buildXlsx(data, 'Permits', widths);
  const fname = `permits-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(buf);
}));

// تفاصيل تصريح
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const permit = db.prepare(`SELECT * FROM permits WHERE id=?`).get(req.params.id);
  if (!permit) throw httpError(404, 'التصريح غير موجود.');
  // منع IDOR: المقدّم لا يرى إلا تصاريح طلباته
  if (req.user.role === 'applicant') {
    const own = db.prepare(`SELECT 1 FROM permit_requests WHERE id=? AND created_by=?`).get(permit.request_id, req.user.id);
    if (!own) throw httpError(403, 'غير مصرّح.');
  }
  res.json({ permit });
}));

// وثيقة التصريح = ملف التصريح الرسمي المرفوع من المراجِع
router.get('/:id/document', authenticate, asyncHandler(async (req, res) => {
  const permit = db.prepare(`SELECT * FROM permits WHERE id=?`).get(req.params.id);
  if (!permit) throw httpError(404, 'التصريح غير موجود.');
  // المقدّم لا يرى إلا تصاريحه
  if (req.user.role === 'applicant') {
    const own = db.prepare(`SELECT 1 FROM permit_requests WHERE id=? AND created_by=?`).get(permit.request_id, req.user.id);
    if (!own) throw httpError(403, 'غير مصرّح.');
  }
  if (!permit.permit_file_id) throw httpError(404, 'لا يوجد ملف تصريح مرفوع.');
  const att = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(permit.permit_file_id);
  if (!att) throw httpError(404, 'ملف التصريح غير موجود.');
  const filePath = path.join(config.paths.uploads, att.storage_key);
  if (!fs.existsSync(filePath)) throw httpError(404, 'ملف التصريح غير موجود على الخادم.');
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(att.original_name)}"`);
  fs.createReadStream(filePath).pipe(res);
}));

// إلغاء تصريح
router.post('/:id/cancel', authenticate, authorize('reviewer'), asyncHandler(async (req, res) => {
  const permit = db.prepare(`SELECT * FROM permits WHERE id=?`).get(req.params.id);
  if (!permit) throw httpError(404, 'التصريح غير موجود.');
  if (permit.status !== 'active') throw httpError(409, 'لا يمكن إلغاء تصريح غير فعّال.');
  const reason = req.body.reason?.trim();
  if (!reason) throw httpError(400, 'سبب الإلغاء مطلوب.');

  db.prepare(`UPDATE permits SET status='cancelled', cancelled_reason=? WHERE id=?`).run(reason, permit.id);
  audit({ req, action: 'CANCEL', entityType: 'permit', entityId: permit.id,
    oldValue: { status: 'active' }, newValue: { status: 'cancelled', reason } });

  const request = db.prepare(`SELECT created_by FROM permit_requests WHERE id=?`).get(permit.request_id);
  notify({ userId: request?.created_by, reqId: permit.request_id, title: 'تم إلغاء تصريحك', body: `${permit.permit_number}: ${reason}` });
  res.json({ ok: true });
}));

// حذف تصريح نهائياً من قاعدة البيانات (لإتاحة إضافة تصريح جديد بنفس رقم الهوية)
router.delete('/:id', authenticate, authorize('reviewer', 'support'), asyncHandler(async (req, res) => {
  const permit = db.prepare(`SELECT * FROM permits WHERE id=?`).get(req.params.id);
  if (!permit) throw httpError(404, 'التصريح غير موجود.');

  // حذف ملف التصريح المرفوع (إن لم يكن مشتركاً مع مرفق آخر)
  if (permit.permit_file_id) {
    const att = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(permit.permit_file_id);
    if (att) {
      const shared = db.prepare(`SELECT COUNT(*) c FROM attachments WHERE storage_key=? AND id<>?`).get(att.storage_key, att.id).c;
      if (!shared) {
        const fp = path.join(config.paths.uploads, att.storage_key);
        try { if (fs.existsSync(fp)) fs.rmSync(fp); } catch { /* تجاهل */ }
      }
      db.prepare(`DELETE FROM attachments WHERE id=?`).run(att.id);
    }
  }
  db.prepare(`DELETE FROM permits WHERE id=?`).run(permit.id);
  audit({ req, action: 'DELETE', entityType: 'permit', entityId: permit.id,
    oldValue: { permit_number: permit.permit_number, national_id: permit.national_id, status: permit.status } });
  res.json({ ok: true });
}));

export default router;
