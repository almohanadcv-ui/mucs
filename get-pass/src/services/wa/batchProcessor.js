/*
 * batchProcessor.js — معالجة دفعة المهندس (مطابقة بالوجه + تحقّق + رفع واحد لكل شخص)
 * --------------------------------------------------------------------------------
 * عند تفعيل مطابقة الوجه: ننتظر اكتمال الدفعة (debounce)، ثم:
 *  1) لكل إقامة (حسب الرقم) نأخذ الوجه المضمّن في صورتها.
 *  2) كل صورة شخصية (بلا رقم) نطابقها بأقرب إقامة بالوجه ونلحقها بها.
 *  3) إن تحقّق الوجه → رفع تلقائي + ردّ واحد بالاسم؛ وإلا → تعليق للمراجِع (لا تُرسل للجهة بلا تحقّق).
 */
import path from 'node:path';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';
import { notify } from '../notifications.js';
import { registerHandler, enqueue } from './queue.js';
import { autoApprovePackage } from './requestCreator.js';
import { faceDescriptor, descriptorDistance } from './faceMatch.js';
import { aiMatchPhoto } from './idExtractor.js';
import { resolveWaId } from './linking.js';
import { sendText } from './outbound.js';
import { maybeAutoExport } from './exporter.js';
import { getLastMsg } from './waClient.js';

function reviewerIds() {
  return db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code IN ('reviewer','support') AND u.is_active=1`).all().map((x) => x.id);
}

/** يجدول معالجة دفعة المهندس بعد فترة هدوء (debounce: واحدة معلّقة لكل مهندس). */
export function scheduleBatch(userId) {
  if (!userId) return;
  db.prepare(`DELETE FROM wa_jobs WHERE type='wa.batch' AND status='pending' AND json_extract(payload,'$.userId')=?`).run(userId);
  enqueue('wa.batch', { userId }, { runAfterSeconds: Math.round(config.wa.batchIdleMs / 1000) });
}

async function safeDescriptor(fullPath) {
  try { return await faceDescriptor(fullPath); }
  catch (e) { console.warn('وصف الوجه فشل:', e?.message || e); return null; }
}

async function processBatch(userId) {
  const up = config.paths.uploads;
  // إقامات/هويات المهندس غير المنشأة بعد
  const pkgs = db.prepare(`SELECT * FROM wa_packages WHERE user_id=? AND status IN ('collecting','ready') AND national_id IS NOT NULL`).all(userId);
  if (!pkgs.length) return;

  // مستند الهوية لكل حزمة (يحوي صورة الشخص)
  const cands = [];
  for (const p of pkgs) {
    const idDoc = db.prepare(`SELECT storage_key, mime_type FROM wa_documents WHERE package_id=? AND kind IN ('iqama','national') ORDER BY confidence DESC LIMIT 1`).get(p.id);
    if (idDoc) cands.push({ pkg: p, path: path.join(up, idDoc.storage_key), mimetype: idDoc.mime_type, national_id: p.national_id });
  }
  if (!cands.length) return;

  // الصور الشخصية غير الملتحقة
  const photos = db.prepare(`
    SELECT * FROM wa_documents WHERE user_id=? AND kind='personal_photo'
      AND (package_id IS NULL OR package_id IN (SELECT id FROM wa_packages WHERE status NOT IN ('created')))
  `).all(userId);

  // مطابقة الصور المنفصلة بالوجه — اختيارية وصارمة (مُطفأة افتراضياً لتفادي الدمج الخاطئ).
  // كل صورة تُستخدم مرّة واحدة، ولا تُضاف لحزمة لديها صورة بالفعل.
  if (config.wa.autoMatchPhotos && config.wa.anthropicApiKey) {
    for (const ph of photos) {
      // تخطَّ الحزم التي لديها صورة شخصية أصلاً (تفادي التكرار #4)
      const open = cands.filter((c) => !db.prepare(`SELECT 1 FROM wa_documents WHERE package_id=? AND kind='personal_photo' LIMIT 1`).get(c.pkg.id));
      if (!open.length) break;
      const r = await aiMatchPhoto(path.join(up, ph.storage_key), ph.mime_type, open).catch((e) => { console.warn('مطابقة Claude:', e?.message || e); return null; });
      if (r && r.confidence >= config.wa.faceMatchMinConfidence) {
        db.prepare(`UPDATE wa_documents SET package_id=?, status='processed' WHERE id=?`).run(r.candidate.pkg.id, ph.id);
        db.prepare(`UPDATE wa_packages SET face_match=1, face_distance=? WHERE id=?`).run(null, r.candidate.pkg.id);
        audit({ action: 'FACE_MATCH', entityType: 'wa_package', entityId: r.candidate.pkg.id, newValue: { match: true, confidence: r.confidence } });
      }
    }
  }

  // لكل شخص: ارفع طلباً (المستند نفسه يحوي صورة الشخص). الفشل فقط لتكرار/رقم غير صالح.
  const created = [], held = [];
  for (const c of cands) {
    const p = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(c.pkg.id);
    if (!p || p.status === 'created' || p.status === 'blocked') continue;
    if (!config.wa.autoApprove) continue;
    const r = autoApprovePackage(p.id, { silent: true });
    if (r.ok) created.push({ name: r.beneficiary_name, num: r.request_number });
    else held.push({ nid: p.national_id, reason: r.reason });
  }

  // تقرير واحد موحّد للمهندس عبر واتساب (مع تمييز المكرّر)
  const isDup = (s) => /قيد المعالجة|تصريح فعّال/.test(s || '');
  const dup = held.filter((h) => isDup(h.reason));
  const other = held.filter((h) => !isDup(h.reason));
  const wa = resolveWaId(userId);
  if (wa && (created.length || held.length)) {
    const lines = ['📋 نتيجة معالجة دفعتك:'];
    lines.push(`✅ تم رفع ${created.length} طلب${created.length ? ':' : ''}`);
    created.forEach((c) => lines.push(`• ${c.name || '—'} (${c.num})`));
    if (dup.length) {
      lines.push(`⛔ مرفوض ${dup.length} (موجود مسبقاً):`);
      dup.forEach((h) => lines.push(`• ${h.nid} — ${h.reason}`));
    }
    if (other.length) {
      lines.push(`⏳ معلّق ${other.length} (يحتاج مراجعة):`);
      other.forEach((h) => lines.push(`• ${h.nid}: ${h.reason}`));
    }
    const lm = getLastMsg(userId); // الردّ على آخر رسالة من المهندس
    const opts = lm ? { chatId: lm.chatId, quotedMessageId: lm.msgId } : {};
    sendText(wa, lines.join('\n'), opts).catch((e) => console.warn('تقرير المهندس:', e?.message || e));
  }

  // بعد اكتمال الدفعة: صدّر كل الطلبات الجديدة دفعةً إن بلغت الحدّ (10+)
  try { maybeAutoExport(); } catch (e) { console.error('تصدير تلقائي:', e?.message || e); }
}

registerHandler('wa.batch', async (payload) => { await processBatch(payload.userId); });
