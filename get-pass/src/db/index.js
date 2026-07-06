import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// تأكد من وجود مجلدات البيانات والمرفقات
fs.mkdirSync(config.paths.data, { recursive: true });
fs.mkdirSync(config.paths.uploads, { recursive: true });

export const db = new Database(config.paths.db);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// تطبيق المخطط (idempotent بفضل IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ترحيلات خفيفة لإضافة الأعمدة المستجدّة على قواعد بيانات قائمة
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('permit_requests', 'id_type', `TEXT NOT NULL DEFAULT 'national'`);
ensureColumn('permit_requests', 'beneficiary_name', `TEXT NOT NULL DEFAULT ''`);
ensureColumn('permit_requests', 'sponsorship', `TEXT NOT NULL DEFAULT 'mab'`);
ensureColumn('permit_requests', 'sponsor_company', `TEXT`);
// حقول قالب الجهة (Qiddiya gate pass)
ensureColumn('permit_requests', 'first_name', `TEXT`);
ensureColumn('permit_requests', 'last_name', `TEXT`);
ensureColumn('permit_requests', 'employee_no', `TEXT`);
ensureColumn('permit_requests', 'job_title', `TEXT`);
ensureColumn('permit_requests', 'nationality', `TEXT`);
ensureColumn('permit_requests', 'company_email', `TEXT`);
ensureColumn('permit_requests', 'mobile', `TEXT`);
ensureColumn('permit_requests', 'dob', `TEXT`);
ensureColumn('permit_requests', 'address', `TEXT`);
ensureColumn('permit_requests', 'visit_location', `TEXT`);
ensureColumn('permit_requests', 'doc_expiry', `TEXT`); // تاريخ نهاية الهوية/الإقامة (عمود Expiration Date في القالب)
ensureColumn('permit_requests', 'exported_at', `TEXT`); // وقت تصديره للجهة (يمنع التصدير المكرّر حتى بعد إعادة التشغيل)
ensureColumn('permits', 'expiry_notified', `INTEGER NOT NULL DEFAULT 0`);
ensureColumn('permits', 'permit_file_id', `TEXT`);
ensureColumn('permits', 'last_expiry_notice', `TEXT`);
ensureColumn('users', 'pw_enc', `TEXT`);
ensureColumn('users', 'session_id', `TEXT`);
ensureColumn('users', 'password_plain', `TEXT`); // كلمة المرور مقروءة (لعرضها من قاعدة البيانات)
ensureColumn('users', 'set_password', `TEXT`);   // اكتب هنا كلمة جديدة من DB Browser ← يطبّقها النظام تلقائياً
ensureColumn('users', 'undertaking_signature', `TEXT`); // صورة التوقيع الإلكتروني (data URL)
ensureColumn('users', 'undertaking_name', `TEXT`);      // الاسم الموقَّع به
ensureColumn('users', 'undertaking_accepted_at', `TEXT`);
ensureColumn('users', 'undertaking_pdf_key', `TEXT`);
ensureColumn('users', 'tour_completed_at', `TEXT`);
ensureColumn('users', 'last_login_at', `TEXT`);
ensureColumn('users', 'last_activity_at', `TEXT`);

// رموز التحقّق الثنائي عبر البريد (OTP)
db.exec(`CREATE TABLE IF NOT EXISTS login_otps(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
ensureColumn('notifications', 'req_id', `TEXT`);
ensureColumn('wa_packages', 'face_match', `INTEGER`);   // 1=تطابق، 0=لا، NULL=غير محسوم
ensureColumn('wa_packages', 'face_distance', `REAL`);   // مسافة تشابه الوجهين

// الدفعة 5: السماح بحالة 'dead' في wa_jobs (Dead Letter Queue) على قواعد قائمة
(function migrateWaJobsDead() {
  const t = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='wa_jobs'`).get();
  if (!t || t.sql.includes("'dead'")) return; // جديدة أصلاً أو مُرحّلة
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE wa_jobs__new (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed','dead')),
        attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
        run_after TEXT NOT NULL DEFAULT (datetime('now')), last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO wa_jobs__new SELECT id,type,payload,status,attempts,max_attempts,run_after,last_error,created_at,updated_at FROM wa_jobs;
      DROP TABLE wa_jobs;
      ALTER TABLE wa_jobs__new RENAME TO wa_jobs;
      CREATE INDEX IF NOT EXISTS idx_wa_jobs_status ON wa_jobs(status, run_after);
    `);
  });
  tx();
  console.log('🔧 ترحيل wa_jobs: أُضيفت حالة dead (DLQ).');
})();

/**
 * توليد رقم تسلسلي ذرّي (atomic) داخل معاملة.
 * @param {string} name اسم العدّاد
 * @returns {number}
 */
export function nextSequence(name) {
  const tx = db.transaction((seqName) => {
    db.prepare(
      `INSERT INTO sequences(name, value) VALUES(?, 1)
       ON CONFLICT(name) DO UPDATE SET value = value + 1`
    ).run(seqName);
    return db.prepare(`SELECT value FROM sequences WHERE name = ?`).get(seqName).value;
  });
  return tx(name);
}

export default db;
