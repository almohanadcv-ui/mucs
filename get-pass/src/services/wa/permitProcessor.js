/*
 * permitProcessor.js — معالجة التصاريح الواردة من المراجِع (الدفعة النهائية)
 * -----------------------------------------------------------------------
 * المراجِع يرسل التصاريح (من الجهة) → Claude يقرأ الهوية → مطابقة طلب في الموقع →
 * إصدار التصريح + اعتماد + توزيعه للمهندس. ثم تقرير واحد للمراجِع (صُدِر/غير موجود).
 */
import path from 'node:path';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';
import { extractIdFile } from './idExtractor.js';
import { registerHandler, enqueue } from './queue.js';
import { issuePermitFromAgent } from '../issuance.js';
import { toISODate } from '../../utils/dateNormalize.js';
import { recordDistribution } from './distributor.js';

// يلتقط تاريخ انتهاء التصريح من نصّ البطاقة: أحدث تاريخ مكتوب (بطاقة التصريح فيها تاريخ واحد غالباً)
function permitExpiryFromText(text) {
  const t = String(text || '').replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 1632));
  const found = t.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}\b/g) || [];
  const iso = found.map(toISODate).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  if (!iso.length) return null;
  iso.sort();
  return iso[iso.length - 1]; // الأحدث = الأرجح أنه تاريخ الانتهاء
}
import { sendText } from './outbound.js';
import { getLastMsg } from './waClient.js';

function addDays(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

/** يجدول تقرير المراجِع بعد فترة هدوء (debounce). */
export function scheduleReviewerReport(reviewerWa) {
  if (!reviewerWa) return;
  db.prepare(`DELETE FROM wa_jobs WHERE type='wa.permit_report' AND status='pending' AND json_extract(payload,'$.reviewerWa')=?`).run(reviewerWa);
  enqueue('wa.permit_report', { reviewerWa }, { runAfterSeconds: Math.round(config.wa.batchIdleMs / 1000) });
}

// معالجة تصريح واحد: قراءة → مطابقة → إصدار → توزيع
registerHandler('wa.permit', async (payload) => {
  const doc = db.prepare(`SELECT * FROM wa_documents WHERE id=?`).get(payload.documentId);
  if (!doc) throw new Error('wa_document غير موجود: ' + payload.documentId);
  const filePath = path.join(config.paths.uploads, doc.storage_key);
  const ex = await extractIdFile({ path: filePath, mimetype: doc.mime_type, originalname: doc.storage_key });
  const nid = ex.national_id;

  let status = 'notfound', name = ex.full_name || null, reason = null;
  if (nid) {
    const request = db.prepare(`SELECT * FROM permit_requests WHERE national_id=? AND status IN ('new','under_review','info_required') ORDER BY submitted_at DESC LIMIT 1`).get(nid);
    const activePermit = db.prepare(`SELECT permit_number, holder_name FROM permits WHERE national_id=? AND status='active' ORDER BY issued_at DESC LIMIT 1`).get(nid);
    if (request) {
      name = request.beneficiary_name || name;
      // تاريخ الانتهاء من نصّ بطاقة التصريح (أحدث تاريخ) أولاً، ثم doc_expiry، ثم تاريخ الطلب، ثم الافتراضي
      const validTo = permitExpiryFromText(ex.extractedText) || ex.doc_expiry || request.doc_expiry || null;
      const issued = issuePermitFromAgent({ request, filePath, originalName: doc.storage_key, mime: doc.mime_type, validTo, source: 'whatsapp-reviewer' });
      if (issued.ok) {
        status = 'issued';
        try { recordDistribution({ permitId: issued.permitId, requestId: request.id, nationalId: nid, permitNumber: issued.permitNumber, requestNumber: request.request_number, engineerUserId: request.created_by }); } catch (e) { console.error('توزيع التصريح:', e.message); }
      } else if (/معتمد مسبقاً|فعّال بالفعل/.test(issued.reason || '')) {
        status = 'already'; reason = issued.reason; // ليس فشلاً — سبق إصداره
      } else {
        status = 'issue_failed'; reason = issued.reason;
      }
    } else if (activePermit) {
      // رقم صحيح بلا طلب مفتوح لكن له تصريح فعّال = سبق إصداره (ليس فشلاً ولا "غير موجود")
      status = 'already'; name = activePermit.holder_name || name; reason = activePermit.permit_number;
    }
    // وإلا: رقم صحيح بلا طلب ولا تصريح = notfound
  }
  db.prepare(`UPDATE wa_documents SET kind='permit', national_id=?, status=?, ocr_json=? WHERE id=?`).run(nid || null, status, JSON.stringify({ ...ex, holder: name, reason }), doc.id);
  audit({ action: 'WA_PERMIT_PROCESSED', entityType: 'wa_document', entityId: doc.id, newValue: { national_id: nid, status, name } });
  scheduleReviewerReport(doc.from_id);
});

// تقرير واحد للمراجِع
registerHandler('wa.permit_report', async (payload) => {
  const wa = payload.reviewerWa;
  const docs = db.prepare(`
    SELECT national_id, status, ocr_json, created_at FROM wa_documents
    WHERE kind='permit' AND from_id=? AND status IN ('issued','notfound','issue_failed','already')
      AND created_at >= datetime('now','-15 minutes')
    ORDER BY created_at
  `).all(wa);
  if (!docs.length) return;
  const parse = (d) => { try { return JSON.parse(d.ocr_json || '{}'); } catch { return {}; } };
  const nameOf = (d) => parse(d).holder || d.national_id;
  const reasonOf = (d) => parse(d).reason || '';

  // إزالة التكرار: نفس الرقم قد يُرسل عدّة مرّات — نحتفظ بأفضل حالة (صدر > سبق > فشل > غير موجود)
  const rank = { issued: 3, already: 2, issue_failed: 1, notfound: 0 };
  const best = new Map();
  for (const d of docs) {
    const key = d.national_id || nameOf(d);
    if (!best.has(key) || rank[d.status] > rank[best.get(key).status]) best.set(key, d);
  }
  const uniq = [...best.values()];
  const issued = uniq.filter((d) => d.status === 'issued');
  const already = uniq.filter((d) => d.status === 'already');
  const notfound = uniq.filter((d) => d.status === 'notfound');
  const failed = uniq.filter((d) => d.status === 'issue_failed');

  const lines = ['📋 نتيجة مراجعة التصاريح:'];
  lines.push(`✅ صُدِر وأُرسل للمهندس: ${issued.length}`);
  issued.forEach((d) => lines.push(`• ${nameOf(d)} (${d.national_id})`));
  if (already.length) { lines.push(`ℹ️ سبق إصداره مسبقاً: ${already.length}`); already.forEach((d) => lines.push(`• ${nameOf(d)} (${d.national_id})`)); }
  if (notfound.length) { lines.push(`⛔ لا يوجد طلب مطابق: ${notfound.length}`); notfound.forEach((d) => lines.push(`• ${d.national_id || nameOf(d)}`)); }
  if (failed.length) { lines.push(`⚠️ تعذّر الإصدار: ${failed.length}`); failed.forEach((d) => lines.push(`• ${nameOf(d)}${reasonOf(d) ? ' — ' + reasonOf(d) : ''}`)); }

  const lm = getLastMsg(wa);
  const opts = lm ? { chatId: lm.chatId, quotedMessageId: lm.msgId } : {};
  try { await sendText(wa, lines.join('\n'), opts); } catch (e) { console.warn('تقرير المراجِع:', e?.message || e); }
});
