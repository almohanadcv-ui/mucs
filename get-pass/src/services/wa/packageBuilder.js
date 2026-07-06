/*
 * packageBuilder.js — تجميع مستندات الشخص وبناء مسودّة (الدفعة 2، المسار ب)
 * ----------------------------------------------------------------------
 * يعالج كل مستند (تصنيف + OCR)، يجمّعه في حزمة حسب national_id، وعند الاكتمال
 * يُحوّل الحزمة إلى "ready" (مسودّة) ويُشعر المراجِع — ❗ بلا إنشاء permit_request.
 * يُسجّل registerHandler('wa.doc') تلقائياً عند الاستيراد.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';
import { notify } from '../notifications.js';
import { registerHandler } from './queue.js';
import { classify } from './classifier.js';
import { extractIdFile } from './idExtractor.js';
import { autoApprovePackage } from './requestCreator.js';
import { scheduleBatch } from './batchProcessor.js';
import { makeLimiter } from './rateLimiter.js';

const uploadGate = makeLimiter(config.wa.uploadRate, 'upload'); // تحديد معدّل معالجة المستندات (OCR)

function reviewerIds() {
  return db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code IN ('reviewer','support') AND u.is_active=1`).all().map((x) => x.id);
}

function packageKinds(pkgId) {
  return new Set(db.prepare(`SELECT DISTINCT kind FROM wa_documents WHERE package_id=?`).all(pkgId).map((r) => r.kind));
}

function missingDocs(pkgId) {
  // بلا OCR دقيق: التصنيف غير موثوق (tesseract) → نعتمد على عدد المستندات فقط
  if (!config.wa.accurateOcr) {
    const n = db.prepare(`SELECT COUNT(*) c FROM wa_documents WHERE package_id=?`).get(pkgId).c;
    const need = config.wa.requiredDocs.length || 2;
    return { missing: n >= need ? [] : [`بانتظار مستندات (${n}/${need})`] };
  }
  // وضع دقيق: الإقامة/الهوية وحدها تكفي (تحتوي الرقم + الاسم + صورة الشخص)
  const kinds = packageKinds(pkgId);
  const hasId = kinds.has('national') || kinds.has('iqama');
  return { missing: hasId ? [] : ['هوية/إقامة'] };
}

function buildDraft(pkg) {
  const idDoc = db.prepare(`SELECT ocr_json, kind FROM wa_documents WHERE package_id=? AND kind IN ('national','iqama') ORDER BY created_at DESC LIMIT 1`).get(pkg.id);
  const j = idDoc?.ocr_json ? JSON.parse(idDoc.ocr_json) : {};
  return {
    national_id: pkg.national_id,
    id_type: idDoc?.kind || 'national',
    full_name: j.full_name || `${j.first_name || ''} ${j.last_name || ''}`.trim(),
    dob: j.dob || '',
    doc_expiry: j.doc_expiry || '',
    nationality: j.nationality || '',
    confidence: j.confidence || 0,
  };
}

function draftSummary(pkg, draft) {
  const eng = pkg.user_id ? db.prepare(`SELECT full_name FROM users WHERE id=?`).get(pkg.user_id)?.full_name : 'غير مربوط';
  return [
    '📝 مسودّة طلب (تحتاج موافقتك)',
    `المهندس: ${eng || '—'}`,
    `النوع: ${draft.id_type === 'iqama' ? 'إقامة' : 'هوية وطنية'}`,
    `الهوية: ${draft.national_id}`,
    `الاسم: ${draft.full_name || '—'}`,
    `الميلاد: ${draft.dob || '—'} | انتهاء الوثيقة: ${draft.doc_expiry || '—'}`,
    `ثقة القراءة: ${draft.confidence}%`,
    `رقم الحزمة: ${pkg.id}`,
    'القرار: YES لإنشاء الطلب رسمياً، NO للرفض.',
  ].join('\n');
}

async function handleDoc(payload) {
  const doc = db.prepare(`SELECT * FROM wa_documents WHERE id=?`).get(payload.documentId);
  if (!doc) throw new Error('wa_document غير موجود: ' + payload.documentId);

  await uploadGate(); // تحديد معدّل طابور الرفع/المعالجة (OCR ثقيل)
  const filePath = path.join(config.paths.uploads, doc.storage_key);
  const extracted = await extractIdFile({ path: filePath, mimetype: doc.mime_type, originalname: doc.storage_key });
  // نموذج الرؤية يصنّف بنفسه؛ وإلا نستخدم المصنّف الاستدلالي
  const cls = extracted.kind ? { kind: extracted.kind, confidence: extracted.confidence || 90 } : classify({ mimetype: doc.mime_type, text: extracted.extractedText, extracted });

  db.prepare(`UPDATE wa_documents SET kind=?, national_id=?, ocr_json=?, raw_text=?, confidence=?, status='processed' WHERE id=?`)
    .run(cls.kind, extracted.national_id || null, JSON.stringify(extracted), extracted.extractedText || '', extracted.confidence || cls.confidence, doc.id);
  audit({ action: 'WA_DOC_OCR', entityType: 'wa_document', entityId: doc.id, newValue: { kind: cls.kind, national_id: extracted.national_id, confidence: extracted.confidence } });

  const nid = extracted.national_id;

  // وضع «بلا OCR دقيق»: نجمّع كل مستندات المهندس في حزمة واحدة (الدقّة عبر تأكيد المراجِع للرقم)
  if (!config.wa.accurateOcr) {
    if (!doc.user_id) { db.prepare(`UPDATE wa_documents SET status='no_user' WHERE id=?`).run(doc.id); return; }
    let pkg = db.prepare(`SELECT * FROM wa_packages WHERE user_id=? AND status='collecting' ORDER BY last_doc_at DESC LIMIT 1`).get(doc.user_id);
    if (!pkg) {
      const pid = randomUUID();
      db.prepare(`INSERT INTO wa_packages(id, national_id, user_id, status, last_doc_at) VALUES(?,?,?, 'collecting', datetime('now'))`).run(pid, nid || null, doc.user_id);
      pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(pid);
      audit({ action: 'WA_PACKAGE_NEW', entityType: 'wa_package', entityId: pid, newValue: { user_id: doc.user_id, mode: 'engineer' } });
    } else if (!pkg.national_id && nid) {
      db.prepare(`UPDATE wa_packages SET national_id=? WHERE id=?`).run(nid, pkg.id);
    }
    db.prepare(`UPDATE wa_documents SET package_id=?, status='processed' WHERE id=?`).run(pkg.id, doc.id);
    db.prepare(`UPDATE wa_packages SET last_doc_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(pkg.id);
    maybeReady(pkg.id);
    return;
  }

  // وضع دقيق: مستند بلا رقم (صورة شخصية منفصلة) — لا نُلحقه بشكل أعمى (يمنع الدمج الخاطئ).
  // يُترك للمطابقة الاختيارية في الدفعة (إن فُعّلت) أو للمراجِع.
  if (!nid) {
    db.prepare(`UPDATE wa_documents SET status='no_id' WHERE id=?`).run(doc.id);
    if (config.wa.faceMatchEnabled && doc.user_id) scheduleBatch(doc.user_id);
    return;
  }

  // اربط بحزمة الشخص (national_id + user) أو أنشئها — تشمل ready (لدمج المقيم+الإقامة بنفس الرقم)
  let pkg = db.prepare(`SELECT * FROM wa_packages WHERE national_id=? AND IFNULL(user_id,'')=IFNULL(?, '') AND status IN ('collecting','ready')`).get(nid, doc.user_id);
  if (!pkg) {
    const pid = randomUUID();
    db.prepare(`INSERT INTO wa_packages(id, national_id, user_id, status, last_doc_at) VALUES(?,?,?, 'collecting', datetime('now'))`).run(pid, nid, doc.user_id);
    pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(pid);
    audit({ action: 'WA_PACKAGE_NEW', entityType: 'wa_package', entityId: pid, newValue: { national_id: nid, user_id: doc.user_id } });
  }
  db.prepare(`UPDATE wa_documents SET package_id=? WHERE id=?`).run(pkg.id, doc.id);
  db.prepare(`UPDATE wa_packages SET last_doc_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(pkg.id);

  maybeReady(pkg.id);
  if (config.wa.faceMatchEnabled && doc.user_id) scheduleBatch(doc.user_id); // مطابقة بالوجه بعد اكتمال الدفعة
}

/** إن اكتملت المستندات → حوّل الحزمة لمسودّة جاهزة وأشعر المراجِع (بلا إنشاء طلب). */
export function maybeReady(pkgId) {
  const pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(pkgId);
  if (!pkg || pkg.status !== 'collecting') return;
  const { missing } = missingDocs(pkgId);
  if (missing.length) return; // لم تكتمل بعد

  db.prepare(`UPDATE wa_packages SET status='ready', updated_at=datetime('now') WHERE id=?`).run(pkgId);
  const draft = buildDraft(pkg);
  audit({ action: 'WA_PACKAGE_READY', entityType: 'wa_package', entityId: pkgId, newValue: draft });
  // مع مطابقة الوجه: القرار يتم في معالجة الدفعة (مطابقة الصور بالإقامات ثم رفع/تعليق)
  if (config.wa.faceMatchEnabled) {
    if (pkg.user_id) scheduleBatch(pkg.user_id);
    return;
  }
  // اعتماد تلقائي فوري (بلا مطابقة وجه) — يُنشئ الطلب ويُشعر
  if (config.wa.autoApprove) {
    autoApprovePackage(pkgId);
    return;
  }
  // مراجعة يدوية → إشعار مسوّدة واحد
  const summary = draftSummary(pkg, draft);
  for (const uid of reviewerIds()) notify({ userId: uid, channel: 'whatsapp', reqId: null, title: 'مسودّة طلب جاهزة للمراجعة (واتساب)', body: summary });
}

/** مسح دوري: الحزم العالقة في "collecting" بعد انتهاء المهلة → blocked (مستندات ناقصة). */
export function sweepTimedOutPackages() {
  const secs = Math.round(config.wa.packageTimeoutMs / 1000);
  const stale = db.prepare(`SELECT id, national_id, user_id FROM wa_packages WHERE status='collecting' AND last_doc_at <= datetime('now', ?)`).all(`-${secs} seconds`);
  for (const p of stale) {
    const { missing } = missingDocs(p.id);
    const reason = 'انتهت مهلة التجميع — ناقص: ' + (missing.join('، ') || '—');
    db.prepare(`UPDATE wa_packages SET status='blocked', reason=?, updated_at=datetime('now') WHERE id=?`).run(reason, p.id);
    audit({ action: 'WA_PACKAGE_TIMEOUT', entityType: 'wa_package', entityId: p.id, newValue: { missing } });
    if (p.user_id) notify({ userId: p.user_id, channel: 'whatsapp', title: 'لم تكتمل مستنداتك', body: `الهوية ${p.national_id}: ناقص ${missing.join('، ') || ''}. أعد الإرسال.` });
  }
  if (stale.length) console.log(`⏳ واتساب: ${stale.length} حزمة انتهت مهلتها (محجوبة).`);
  return stale.length;
}

registerHandler('wa.doc', handleDoc);
