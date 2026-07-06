/*
 * queue.js — طابور مهام منصّة واتساب (الدفعة 1: الأساس)
 * ---------------------------------------------------
 * طابور مدعوم بـ SQLite (جدول wa_jobs) + عامل (Worker) + إعادة محاولة + استرجاع.
 * معزول خلف العلم config.wa.pipelineEnabled — لا يعمل ولا يؤثّر على شيء إن كان مُطفأً.
 * المعالِجات (handlers) تُسجَّل من الدفعات اللاحقة عبر registerHandler().
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';

const handlers = new Map();

/** تسجيل معالِج لنوع مهمة (تستخدمه الدفعات اللاحقة). */
export function registerHandler(type, fn) { handlers.set(type, fn); }

/** إضافة مهمة للطابور. @returns {string} id */
export function enqueue(type, payload = {}, { runAfterSeconds = 0, maxAttempts } = {}) {
  const id = randomUUID();
  const after = `+${Math.max(0, runAfterSeconds)} seconds`;
  if (maxAttempts != null) {
    db.prepare(`INSERT INTO wa_jobs(id, type, payload, run_after, max_attempts) VALUES(?,?,?, datetime('now', ?), ?)`)
      .run(id, type, JSON.stringify(payload ?? {}), after, maxAttempts);
  } else {
    db.prepare(`INSERT INTO wa_jobs(id, type, payload, run_after) VALUES(?,?,?, datetime('now', ?))`)
      .run(id, type, JSON.stringify(payload ?? {}), after);
  }
  audit({ action: 'WA_JOB_ENQUEUE', entityType: 'wa_job', entityId: id, newValue: { type } });
  return id;
}

/** يحجز أوّل مهمة جاهزة (ذرّياً) ويحوّلها إلى processing. */
function claimNext() {
  const tx = db.transaction(() => {
    const job = db.prepare(`
      SELECT * FROM wa_jobs
      WHERE status='pending' AND run_after <= datetime('now')
      ORDER BY created_at LIMIT 1
    `).get();
    if (!job) return null;
    db.prepare(`UPDATE wa_jobs SET status='processing', attempts=attempts+1, updated_at=datetime('now') WHERE id=?`).run(job.id);
    job.attempts += 1;
    return job;
  });
  return tx();
}

function complete(job) {
  db.prepare(`UPDATE wa_jobs SET status='done', last_error=NULL, updated_at=datetime('now') WHERE id=?`).run(job.id);
  audit({ action: 'WA_JOB_DONE', entityType: 'wa_job', entityId: job.id, newValue: { type: job.type } });
}

function fail(job, err) {
  const msg = (err && err.message) || String(err);
  const retry = job.attempts < job.max_attempts;
  if (retry) {
    const backoff = Math.min(120, job.attempts * 10); // تأخير تصاعدي حتى دقيقتين
    db.prepare(`UPDATE wa_jobs SET status='pending', last_error=?, run_after=datetime('now', ?), updated_at=datetime('now') WHERE id=?`)
      .run(msg, `+${backoff} seconds`, job.id);
    audit({ action: 'RETRY', entityType: 'wa_job', entityId: job.id, newValue: { type: job.type, attempts: job.attempts, error: msg } });
  } else {
    // Dead Letter Queue: تجاوز max_attempts → dead نهائياً (لا تُعاد المحاولة أبداً)
    db.prepare(`UPDATE wa_jobs SET status='dead', last_error=?, updated_at=datetime('now') WHERE id=?`).run(msg, job.id);
    audit({ action: 'DEAD_JOB', entityType: 'wa_job', entityId: job.id, newValue: { type: job.type, attempts: job.attempts, error: msg } });
    console.error(`💀 مهمة ميتة (DLQ): ${job.type} — ${msg}`);
  }
}

async function runJob(job) {
  const fn = handlers.get(job.type);
  if (!fn) throw new Error('لا يوجد معالِج للنوع: ' + job.type);
  const payload = job.payload ? JSON.parse(job.payload) : {};
  await fn(payload, job);
}

let busy = false;
let timer = null;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    let job;
    // عالِج كل المهام الجاهزة في هذه الدورة بالتسلسل
    while ((job = claimNext())) {
      try { await runJob(job); complete(job); }
      catch (e) { fail(job, e); }
    }
  } finally {
    busy = false;
  }
}

/** استرجاع: أي مهمة بقيت "processing" بعد توقّف مفاجئ → تُعاد إلى pending. */
export function recover() {
  const n = db.prepare(`UPDATE wa_jobs SET status='pending', updated_at=datetime('now') WHERE status='processing'`).run().changes;
  if (n) console.log(`♻️ واتساب: استرجاع ${n} مهمة كانت قيد التنفيذ.`);
}

/** معالِج اختباري مبدئي للتأكد من عمل الطابور (يُزال/يُستبدل في الدفعات اللاحقة). */
registerHandler('wa.echo', async (payload) => {
  console.log('🧪 wa.echo:', payload?.text ?? '');
});

/** بدء العامل (لا يعمل إلا عند تفعيل المنصّة). */
export function startWorker() {
  if (!config.wa.pipelineEnabled) {
    console.log('🟡 منصّة واتساب معطّلة (اضبط WA_PIPELINE_ENABLED=1 لتفعيلها).');
    return;
  }
  recover();
  if (timer) clearInterval(timer);
  timer = setInterval(() => { tick().catch((e) => console.error('خطأ عامل الطابور:', e?.message || e)); }, config.wa.workerIntervalMs);
  console.log('✅ عامل طابور واتساب يعمل.');
}

/** للاستخدام في الاختبارات/الإيقاف. */
export function stopWorker() { if (timer) { clearInterval(timer); timer = null; } }
