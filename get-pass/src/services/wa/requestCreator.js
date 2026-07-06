/*
 * requestCreator.js — إنشاء طلب رسمي من حزمة معتمدة (الدفعة 2، المسار ب)
 * --------------------------------------------------------------------
 * يُستدعى فقط بعد موافقة المراجِع (YES). يحترم منطق الأعمال القائم:
 *   validateNationalId + checkPermitBlocking + منع الطلب المفتوح المكرّر.
 * يُدرج مباشرةً في permit_requests + attachments (لا يمرّ عبر HTTP ولا متصفّح).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { validateNationalId } from '../../utils/nationalId.js';
import { generateRequestNumber } from '../../utils/numbers.js';
import { checkPermitBlocking } from '../workflow.js';
import { audit } from '../audit.js';
import { notify } from '../notifications.js';
import { resolveWaId } from './linking.js';
import { sendText } from './outbound.js';

const KIND_TO_FILETYPE = { national: 'id_image', iqama: 'id_image', personal_photo: 'personal_photo', resident_report: 'resident_report' };

function draftFromPackage(pkg) {
  // نأخذ بيانات الهوية من مستند الهوية/الإقامة في الحزمة
  const idDoc = db.prepare(`
    SELECT ocr_json, kind FROM wa_documents
    WHERE package_id=? AND kind IN ('national','iqama') ORDER BY created_at DESC LIMIT 1
  `).get(pkg.id);
  const j = idDoc?.ocr_json ? JSON.parse(idDoc.ocr_json) : {};
  return {
    national_id: pkg.national_id || j.national_id || '',
    id_type: idDoc?.kind === 'iqama' ? 'iqama' : 'national',
    first_name: j.first_name || '',
    last_name: j.last_name || '',
    dob: j.dob || '',
    doc_expiry: j.doc_expiry || '',
    nationality: j.nationality || '',
  };
}

/**
 * ينشئ طلباً رسمياً من حزمة (بعد موافقة المراجِع).
 * @returns {{ ok:boolean, reason?:string, request_id?:string, request_number?:string }}
 */
export function createFromPackage(pkgId, decidedBy = null, override = {}) {
  const pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(pkgId);
  if (!pkg) return { ok: false, reason: 'الحزمة غير موجودة.' };

  const d = draftFromPackage(pkg);
  // المراجِع يؤكّد/يصحّح الرقم (مهم في وضع بلا Vision حيث قد يخطئ OCR)
  if (override.nationalId) {
    d.national_id = String(override.nationalId).replace(/\D/g, '');
    d.id_type = override.idType || (d.national_id[0] === '2' ? 'iqama' : 'national');
  }
  const idType = d.id_type === 'iqama' ? 'iqama' : 'national';

  // 1) تحقّق الهوية
  const v = validateNationalId(d.national_id, idType);
  if (!v.valid) return blocked(pkg, `هوية غير صالحة: ${v.message || ''}`);

  // 2) منع التكرار (تصريح فعّال خارج نافذة التجديد)
  const block = checkPermitBlocking(d.national_id);
  if (block.permit && block.blocked) {
    return blocked(pkg, `يوجد تصريح فعّال (${block.permit.permit_number}) حتى ${block.permit.valid_to}.`);
  }
  // 3) منع طلب مفتوح مكرّر
  const open = db.prepare(`SELECT request_number FROM permit_requests WHERE national_id=? AND status IN ('new','under_review','info_required') LIMIT 1`).get(d.national_id);
  if (open) return blocked(pkg, `يوجد طلب قيد المعالجة (${open.request_number}).`);

  // كل مستندات الحزمة (لا نُهمل 'unknown' — التصنيف غير موثوق بلا Vision)
  const docs = db.prepare(`SELECT kind, storage_key, mime_type FROM wa_documents WHERE package_id=?`).all(pkg.id);
  if (!docs.length) return blocked(pkg, 'لا توجد مستندات في الحزمة.');

  const applicant = pkg.user_id ? db.prepare(`SELECT full_name FROM users WHERE id=?`).get(pkg.user_id) : null;
  const beneficiary = `${d.first_name} ${d.last_name}`.trim() || (applicant?.full_name || '');
  const G = config.gatepass;
  const id = randomUUID();
  const requestNumber = generateRequestNumber();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO permit_requests
        (id, request_number, national_id, id_type, applicant_name, beneficiary_name,
         sponsorship, sponsor_company, purpose, priority, status, created_by,
         first_name, last_name, employee_no, job_title, nationality, company_email, mobile, dob, address, visit_location, doc_expiry)
      VALUES(?,?,?,?,?,?, 'mab', NULL, ?, 'normal', 'new', ?, ?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, requestNumber, d.national_id, idType, applicant?.full_name || 'WhatsApp', beneficiary,
      G.scopeOfWork, pkg.user_id || null,
      d.first_name, d.last_name, '', G.jobTitle,
      idType === 'national' ? G.nationalNationality : (d.nationality || ''),
      G.companyEmail, G.mobile, d.dob, G.city, G.visitLocations[0], d.doc_expiry);

    db.prepare(`INSERT INTO status_history(request_id, from_status, to_status, reason, changed_by) VALUES(?, NULL, 'new', 'أُنشئ عبر واتساب (بموافقة المراجِع)', ?)`).run(id, decidedBy);

    let photoUsed = false;
    for (const doc of docs) {
      let ft = KIND_TO_FILETYPE[doc.kind];
      if (!ft) { // 'unknown' وغيره: أوّل واحد صورة شخصية، والباقي مستند داعم
        if (!photoUsed) { ft = 'personal_photo'; photoUsed = true; } else ft = 'supporting_doc';
      } else if (ft === 'personal_photo') {
        photoUsed = true;
      }
      db.prepare(`INSERT INTO attachments(id, request_id, file_type, original_name, storage_key, mime_type, size_bytes, checksum)
                  VALUES(?,?,?,?,?,?,?,?)`)
        .run(randomUUID(), id, ft, doc.storage_key, doc.storage_key, doc.mime_type, 0, 'wa');
    }
    db.prepare(`UPDATE wa_packages SET status='created', request_id=?, updated_at=datetime('now') WHERE id=?`).run(id, pkg.id);
  });
  tx();

  audit({ actor: { id: decidedBy }, action: 'WA_REQUEST_CREATED', entityType: 'request', entityId: id,
    newValue: { request_number: requestNumber, national_id: d.national_id, package_id: pkg.id } });
  if (pkg.user_id) notify({ userId: pkg.user_id, reqId: id, title: 'تم إنشاء طلبك', body: `رقم الطلب ${requestNumber}` });

  return { ok: true, request_id: id, request_number: requestNumber };
}

function blocked(pkg, reason) {
  db.prepare(`UPDATE wa_packages SET status='blocked', reason=?, updated_at=datetime('now') WHERE id=?`).run(reason, pkg.id);
  audit({ action: 'WA_PACKAGE_BLOCKED', entityType: 'wa_package', entityId: pkg.id, newValue: { reason } });
  return { ok: false, reason };
}

/**
 * اعتماد تلقائي لحزمة جاهزة (بلا تدخّل المراجِع). يستخدم الرقم المقروء من OCR كما هو.
 * عند الفشل (رقم غير صالح/تكرار) تبقى الحزمة محجوبة ويُنبَّه المراجِع.
 */
export function autoApprovePackage(pkgId, opts = {}) {
  const pkg = db.prepare(`SELECT user_id FROM wa_packages WHERE id=?`).get(pkgId);
  const r = createFromPackage(pkgId, null);
  if (r.ok) {
    audit({ action: 'WA_AUTO_APPROVE', entityType: 'request', entityId: r.request_id, newValue: { request_number: r.request_number, package_id: pkgId } });
    const req = db.prepare(`SELECT beneficiary_name FROM permit_requests WHERE id=?`).get(r.request_id);
    r.beneficiary_name = req?.beneficiary_name || '';
    // ردّ فردي للمهندس (إلا في الدفعة — تُرسل تقريراً موحّداً)
    if (!opts.silent) {
      const wa = pkg?.user_id ? resolveWaId(pkg.user_id) : null;
      if (wa) sendText(wa, `✅ تم رفع طلب باسم: ${r.beneficiary_name || '—'}\nرقم الطلب: ${r.request_number}`).catch(() => {});
    }
    return r;
  }
  // فشل الاعتماد التلقائي → يبقى للمراجِع
  const revs = db.prepare(`SELECT u.id FROM users u JOIN roles ro ON ro.id=u.role_id WHERE ro.code IN ('reviewer','support') AND u.is_active=1`).all();
  for (const u of revs) notify({ userId: u.id, channel: 'whatsapp', title: 'تعذّر الاعتماد التلقائي — يحتاج مراجعة', body: `الحزمة ${pkgId}: ${r.reason}` });
  return r;
}
