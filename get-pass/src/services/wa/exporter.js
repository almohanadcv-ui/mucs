/*
 * exporter.js — التصدير الساعي للطلبات الجديدة (الدفعة 3)
 * -----------------------------------------------------
 * كل ساعة: يأخذ الطلبات الجديدة غير المُصدَّرة (exported_at IS NULL)، يبني Excel
 * بقالب الجهة، يحوّلها إلى under_review ويعلّم exported_at (يمنع التكرار حتى بعد إعادة
 * التشغيل)، ثم يضع مهمة إرسال الملف لرقم المراجِع عبر الطابور.
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { changeStatus } from '../workflow.js';
import { audit } from '../audit.js';
import { buildGatePassXlsx } from '../../utils/gatepass.js';
import { registerHandler, enqueue } from './queue.js';
import { sendFile } from './outbound.js';
import { makeLimiter } from './rateLimiter.js';
import { getExportBatchSize, getExportRecipients, getSubmissionWindow } from '../settings.js';

const exportGate = makeLimiter(config.wa.exportRate, 'export');

function systemReviewerId() {
  return db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code IN ('reviewer','support') AND u.is_active=1
    ORDER BY (r.code='reviewer') DESC, u.created_at ASC LIMIT 1
  `).get()?.id || null;
}

/** ينفّذ تصدير الطلبات الجديدة غير المُصدَّرة. @returns {{exported:number, file?:string}} */
export function runHourlyExport() {
  const rows = db.prepare(`
    SELECT r.*, p.permit_number, p.valid_from, p.valid_to
    FROM permit_requests r
    LEFT JOIN permits p ON p.request_id = r.id AND p.status IN ('active','expired')
    WHERE r.status='new' AND r.exported_at IS NULL
    ORDER BY r.submitted_at
  `).all();
  if (!rows.length) return { exported: 0 };

  const issuer = systemReviewerId();
  const buf = buildGatePassXlsx(rows);
  const fname = `gatepass-${new Date().toISOString().slice(0, 10)}-${Date.now()}.xlsx`;
  const fp = path.join(config.paths.uploads, fname);
  fs.writeFileSync(fp, buf);

  const tx = db.transaction(() => {
    for (const r of rows) {
      const reqRow = db.prepare(`SELECT * FROM permit_requests WHERE id=?`).get(r.id);
      if (!reqRow || reqRow.status !== 'new' || reqRow.exported_at) continue; // حماية مزدوجة
      if (!reqRow.assigned_to && issuer) db.prepare(`UPDATE permit_requests SET assigned_to=? WHERE id=?`).run(issuer, r.id);
      changeStatus({ request: reqRow, toStatus: 'under_review', reason: 'تصدير تلقائي للجهة', userId: issuer });
      db.prepare(`UPDATE permit_requests SET exported_at=datetime('now') WHERE id=?`).run(r.id);
    }
  });
  tx();

  audit({ action: 'WA_EXPORT', entityType: 'request', newValue: { count: rows.length, file: fname } });

  const recipients = getExportRecipients();
  if (recipients.length) {
    for (const r of recipients) enqueue('wa.send_export', { filePath: fp, count: rows.length, reviewer: r });
    // ملف ZIP بكل مرفقات الطلبات (كل طلب في مجلد باسمه) — يُبنى ويُرسل بعد Excel
    const zipPath = path.join(config.paths.uploads, `requests-${new Date().toISOString().slice(0, 10)}-${Date.now()}.zip`);
    console.log(`📦 بدء بناء ZIP لمرفقات ${rows.length} طلب...`);
    buildRequestsZip(rows, zipPath)
      .then((res) => {
        if (res) {
          console.log(`📦 تم بناء ZIP وإرساله: ${zipPath}`);
          for (const r of recipients) enqueue('wa.send_export', { filePath: zipPath, reviewer: r, caption: `📦 مرفقات الطلبات (${rows.length}) — كل طلب في مجلد باسمه وصوره.` });
        } else {
          console.warn('📦 لم يُرسَل ZIP — لا توجد مرفقات على القرص لهذه الطلبات.');
        }
      })
      .catch((e) => console.error('📦 خطأ بناء ZIP المرفقات:', e?.message || e));
  } else {
    console.log('⚠️ لا يوجد مستلِم لملف التصدير (أضف رقم مراجِع أو مستلِم Excel).');
  }
  return { exported: rows.length, file: fname };
}

const zipSafe = (v) => String(v || 'unknown').replace(/[^\w.\- ]+/g, '-').replace(/-+/g, '-').trim();
// يبني ملف ZIP يحوي مجلداً لكل طلب باسم الشخص + مرفقاته. يحتاج حزمة archiver.
async function buildRequestsZip(rows, outPath) {
  let archiver;
  try { archiver = (await import('archiver')).default; }
  catch { console.warn('⚠️ حزمة archiver غير مثبّتة — تخطّي ملف ZIP. ثبّتها: npm install archiver'); return null; }
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const arc = archiver('zip', { zlib: { level: 9 } });
    let added = 0;
    output.on('close', () => resolve(added ? outPath : null));
    arc.on('error', reject);
    arc.pipe(output);
    for (const r of rows) {
      const folder = zipSafe(`${r.beneficiary_name || r.applicant_name || r.request_number} - ${r.national_id || r.request_number}`);
      const atts = db.prepare(`SELECT * FROM attachments WHERE request_id=?`).all(r.id);
      for (const a of atts) {
        const src = path.join(config.paths.uploads, a.storage_key);
        if (fs.existsSync(src)) { arc.file(src, { name: `${folder}/${zipSafe(a.file_type)}-${zipSafe(a.original_name)}` }); added++; }
      }
    }
    arc.finalize();
  });
}

// معالِج إرسال ملف التصدير لرقم المراجِع
registerHandler('wa.send_export', async (p) => {
  await exportGate(); // تحديد معدّل طابور التصدير
  await sendFile(p.reviewer, p.filePath, p.caption || `📤 طلبات جديدة للتصدير للجهة (${p.count}). يُرجى إرسالها واستلام التصاريح ثم إعادتها لرقم الوكيل.`);
});

/** تصدير فوري عند بلوغ عدد الطلبات الجديدة حدّ الدفعة (config.wa.exportBatchSize). */
export function maybeAutoExport() {
  const n = db.prepare(`SELECT COUNT(*) c FROM permit_requests WHERE status='new' AND exported_at IS NULL`).get().c;
  if (n >= getExportBatchSize()) {
    console.log(`📦 بلغت الطلبات الجديدة ${n} — تصدير فوري للمراجِع.`);
    return runHourlyExport();
  }
  return { exported: 0, pending: n };
}

let timer = null;
let dailyTimer = null;
let lastDailyRun = null;
export function startHourlyExport() {
  if (!config.wa.pipelineEnabled) return;
  if (dailyTimer) clearInterval(dailyTimer);
  // التصدير يتم تلقائياً بعد إغلاق وقت الاستقبال: يجمع كل طلبات اليوم ويرسلها دفعة واحدة (بلا عتبة عدد)
  dailyTimer = setInterval(() => {
    try {
      const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const day = now.toISOString().slice(0, 10);
      const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const endMin = getSubmissionWindow().endMin;
      if (minutes >= endMin + 1 && lastDailyRun !== day) {
        lastDailyRun = day;
        const r = runHourlyExport();
        if (r.exported) console.log(`📤 تصدير إقفال الاستقبال: ${r.exported} طلب.`);
      }
    } catch (e) { console.error('خطأ تصدير الإقفال:', e?.message || e); }
  }, 60 * 1000);
  console.log('✅ التصدير التلقائي عند إغلاق وقت الاستقبال مُفعّل.');
  console.log(`✅ التصدير الساعي مُفعّل (كل ${Math.round(config.wa.exportIntervalMs / 60000)} دقيقة).`);
}
