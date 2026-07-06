/*
 * distributor.js — توزيع التصاريح على المهندسين (الدفعة 4)
 * ------------------------------------------------------
 * طابور منفصل تماماً عن طابور إنشاء الطلبات (جدول wa_distributions الدائم + حلقته الخاصة).
 * يجمّع تصاريح كل مهندس ثم يرسلها عبر واتساب، مع حماية من الإرسال المكرّر (UNIQUE permit_id
 * + انتقال pending→sent مرّة واحدة) ويبقى بعد إعادة التشغيل (الجدول دائم).
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';
import { notify } from '../notifications.js';
import { resolveWaId } from './linking.js';
import { sendText, sendFile } from './outbound.js';
import { magicLink } from '../../utils/magicLink.js';
import { makeLimiter } from './rateLimiter.js';

const distGate = makeLimiter(config.wa.distributionRate, 'distribution');
let distRunning = false; // يمنع تشغيل دورتي توزيع متزامنتين (تفادي إرسال مزدوج)

function reviewerIds() {
  return db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code IN ('reviewer','support') AND u.is_active=1`).all().map((x) => x.id);
}

/**
 * يسجّل تصريحاً للتوزيع (يُستدعى بعد الإصدار). idempotent عبر UNIQUE(permit_id).
 * @returns {boolean} true إن أُضيف سجل جديد.
 */
export function recordDistribution({ permitId, requestId, nationalId, permitNumber, requestNumber, engineerUserId }) {
  const wa = engineerUserId ? resolveWaId(engineerUserId) : null;
  const sk = db.prepare(`SELECT a.storage_key FROM permits p JOIN attachments a ON a.id=p.permit_file_id WHERE p.id=?`).get(permitId)?.storage_key || null;
  const res = db.prepare(`
    INSERT INTO wa_distributions(id, permit_id, request_id, national_id, permit_number, request_number, engineer_user_id, engineer_wa, storage_key, status)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(permit_id) DO NOTHING
  `).run(randomUUID(), permitId, requestId, nationalId, permitNumber, requestNumber, engineerUserId, wa, sk, wa ? 'pending' : 'unlinked');

  if (res.changes > 0) {
    audit({ action: 'WA_DIST_RECORD', entityType: 'wa_distribution', entityId: permitId, newValue: { permit_number: permitNumber, status: wa ? 'pending' : 'unlinked' } });
    if (!wa) {
      for (const uid of reviewerIds()) notify({ userId: uid, channel: 'whatsapp', title: 'تصريح بانتظار التوزيع — المهندس غير مربوط برقم واتساب', body: `التصريح ${permitNumber} (طلب ${requestNumber}). اربط رقم المهندس ثم سيُرسَل تلقائياً.` });
    }
  }
  return res.changes > 0;
}

/** يوزّع التصاريح المعلّقة، مجمّعةً حسب المهندس (مع تحديد معدّل مستقل). */
export async function runDistribution() {
  if (distRunning) return { sent: 0, busy: true }; // لا دورتان متزامنتان
  distRunning = true;
  try {
    const pending = db.prepare(`SELECT * FROM wa_distributions WHERE status='pending' AND engineer_wa IS NOT NULL ORDER BY engineer_wa, created_at`).all();
    if (!pending.length) return { sent: 0 };

    const byEng = new Map();
    for (const d of pending) { if (!byEng.has(d.engineer_wa)) byEng.set(d.engineer_wa, []); byEng.get(d.engineer_wa).push(d); }

    let sent = 0;
    for (const [wa, list] of byEng) {
      try {
        const link = magicLink(list[0]?.engineer_user_id);
        const reqNums = list.map((d) => d.request_number).filter(Boolean).join('، ');
        let header = `✅ تم إصدار التصاريح (${list.length})`;
        if (reqNums) header += ` للطلبات: ${reqNums}`;
        if (link) header += `\n\n🔗 للدخول المباشر للموقع ومتابعة طلباتك اضغط:\n${link}`;
        await sendText(wa, header);
      } catch (e) {
        // العميل غير متصل → أوقف الدورة، تبقى pending وتُعاد لاحقاً
        console.warn('توزيع مؤجّل (واتساب غير متصل):', e?.message || e);
        return { sent };
      }
      let batchSent = 0;
      for (const d of list) {
        try {
          await distGate(); // تحديد المعدّل المستقل لطابور التوزيع
          const fp = path.join(config.paths.uploads, d.storage_key);
          await sendFile(wa, fp, `الطلب: ${d.request_number || '—'}\nرقم التصريح: ${d.permit_number || '—'}`);
          // انتقال مرّة واحدة فقط (حماية من الإرسال المكرّر)
          const upd = db.prepare(`UPDATE wa_distributions SET status='sent', sent_at=datetime('now'), error=NULL WHERE id=? AND status='pending'`).run(d.id);
          if (upd.changes > 0) {
            audit({ action: 'WA_DIST_SENT', entityType: 'wa_distribution', entityId: d.permit_id, newValue: { permit_number: d.permit_number, request_number: d.request_number } });
            if (d.engineer_user_id) notify({ userId: d.engineer_user_id, reqId: d.request_id, title: 'تم إرسال تصريحك عبر واتساب', body: `${d.permit_number}` });
            sent++; batchSent++;
          }
        } catch (e) {
          db.prepare(`UPDATE wa_distributions SET attempts=attempts+1, error=? WHERE id=?`).run(String(e?.message || e), d.id);
        }
      }
      if (batchSent > 0) audit({ action: 'DISTRIBUTION_BATCH', entityType: 'wa_distribution', entityId: 'batch', newValue: { count: batchSent } });
    }
    if (sent) console.log(`📨 وُزّع ${sent} تصريح على المهندسين.`);
    return { sent };
  } finally {
    distRunning = false;
  }
}

let timer = null;
export function startDistributor() {
  if (!config.wa.pipelineEnabled) return;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { runDistribution().catch((e) => console.error('خطأ الموزّع:', e?.message || e)); }, config.wa.distributeIntervalMs);
  console.log('✅ موزّع التصاريح يعمل (طابور منفصل عن إنشاء الطلبات).');
}
