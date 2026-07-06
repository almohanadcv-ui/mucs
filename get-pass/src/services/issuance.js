/*
 * issuance.js — إصدار تصريح آلياً (يُستخدم من وكيل واتساب)
 * -------------------------------------------------------
 * يُكرّر منطق الإصدار بأمان دون المساس بمسار approve-issue البشري.
 * يحترم القاعدة الذهبية (تصريح فعّال واحد لكل هوية) وآلة الحالات.
 */
import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { generatePermitNumber } from '../utils/numbers.js';
import { getActivePermit, changeStatus } from './workflow.js';
import { toISODate } from '../utils/dateNormalize.js';
import { audit } from './audit.js';
import { notify } from './notifications.js';

// الحساب الذي يُنسب إليه الإصدار (مُعرّف بريد، أو أول مراجِع/دعم فعّال)
function resolveIssuer() {
  const email = config.whatsapp.issuerEmail;
  if (email) {
    const u = db.prepare(`SELECT id FROM users WHERE email=?`).get(email);
    if (u) return u.id;
  }
  const u = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code IN ('reviewer','support') AND u.is_active=1
    ORDER BY (r.code='reviewer') DESC, u.created_at ASC LIMIT 1
  `).get();
  return u?.id || null;
}

function ensureUnderReview(request, userId) {
  if (request.status === 'new' || request.status === 'info_required') {
    if (!request.assigned_to && userId) {
      db.prepare(`UPDATE permit_requests SET assigned_to=? WHERE id=?`).run(userId, request.id);
      request.assigned_to = userId;
    }
    changeStatus({ request, toStatus: 'under_review', userId });
    request.status = 'under_review';
  }
}

function saveAttachment(requestId, filePath, originalName, mime, type = 'permit_file') {
  const buf = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  const id = randomUUID();
  db.prepare(`
    INSERT INTO attachments(id, request_id, file_type, original_name, storage_key, mime_type, size_bytes, checksum)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(id, requestId, type, originalName, path.basename(filePath), mime, buf.length, checksum);
  return id;
}

/**
 * يُصدر تصريحاً لطلب موجود باستخدام ملف وارد.
 * @returns {{ ok:boolean, reason?:string, permitNumber?:string, valid_from?:string, valid_to?:string, permitId?:string }}
 */
export function issuePermitFromAgent({ request, filePath, originalName, mime, validTo, source = 'whatsapp' }) {
  if (['rejected', 'cancelled', 'expired'].includes(request.status)) {
    return { ok: false, reason: 'الطلب منتهٍ أو مرفوض.' };
  }
  if (request.status === 'approved') {
    return { ok: false, reason: 'الطلب معتمد مسبقاً.' };
  }
  const issuer = resolveIssuer();
  if (!issuer) return { ok: false, reason: 'لا يوجد حساب مراجِع/دعم لنسب الإصدار إليه.' };

  const from = new Date().toISOString().slice(0, 10); // تاريخ الاستلام
  // التواريخ غير إلزامية: نطبّع المُدخل، وإن كان غائباً/غير صالح نستخدم المدة الافتراضية بدل الفشل
  let to = toISODate(validTo);
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to <= from) {
    const d = new Date(); d.setDate(d.getDate() + (config.defaultPermitDays || 365));
    to = d.toISOString().slice(0, 10);
  }

  const existing = getActivePermit(request.national_id);
  const permitId = randomUUID();
  const permitNumber = generatePermitNumber();
  const verifyToken = randomUUID().replace(/-/g, '');
  const holder = request.beneficiary_name || request.applicant_name;

  const tx = db.transaction(() => {
    ensureUnderReview(request, issuer);
    changeStatus({ request, toStatus: 'approved', userId: issuer });
    if (existing) db.prepare(`UPDATE permits SET status='expired' WHERE id=?`).run(existing.id);
    const fileId = saveAttachment(request.id, filePath, originalName, mime, 'permit_file');
    db.prepare(`
      INSERT INTO permits(id, permit_number, request_id, national_id, holder_name,
                          status, valid_from, valid_to, issued_by, verify_token, permit_file_id)
      VALUES(?,?,?,?,?, 'active', ?,?,?,?,?)
    `).run(permitId, permitNumber, request.id, request.national_id, holder, from, to, issuer, verifyToken, fileId);
  });
  try { tx(); }
  catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return { ok: false, reason: 'يوجد تصريح فعّال بالفعل لهذه الهوية.' };
    throw err;
  }

  audit({ actor: { id: issuer }, action: 'APPROVE_ISSUE', entityType: 'permit', entityId: permitId,
    newValue: { permit_number: permitNumber, national_id: request.national_id, valid_from: from, valid_to: to, via: source } });
  notify({ userId: request.created_by, reqId: request.id, title: 'تم اعتماد وإصدار تصريحك', body: `${permitNumber} ساري حتى ${to}` });

  return { ok: true, permitNumber, valid_from: from, valid_to: to, permitId };
}
