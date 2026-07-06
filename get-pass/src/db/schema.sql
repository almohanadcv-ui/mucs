-- =====================================================================
--  PAMS - مخطط قاعدة بيانات نظام إدارة التصاريح والموافقات
--  محرك: SQLite (يدعم الفهارس الفريدة الجزئية)
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ----------------------------------------------------------------------
-- الأدوار والصلاحيات (RBAC)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,        -- applicant | officer | supervisor | admin | auditor
  name_ar     TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  code        TEXT PRIMARY KEY,
  name_ar     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  allowed         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_code)
);

-- ----------------------------------------------------------------------
-- المستخدمون (الموظفون والإداريون والمقدّمون الذين يملكون حساباً)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,          -- UUID
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  national_id   TEXT,                      -- للمقدّمين
  password_hash TEXT NOT NULL,
  pw_enc        TEXT,                      -- نسخة مشفّرة (قابلة للاسترجاع) لعرض كلمة المرور
  session_id    TEXT,                      -- لفرض جلسة واحدة فعّالة لكل مستخدم
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  undertaking_accepted_at TEXT,
  undertaking_pdf_key TEXT,
  tour_completed_at TEXT,
  last_login_at TEXT,
  last_activity_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_national ON users(national_id);

-- ----------------------------------------------------------------------
-- الطلبات
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permit_requests (
  id              TEXT PRIMARY KEY,        -- UUID
  request_number  TEXT NOT NULL UNIQUE,    -- PRM-2026-000123
  national_id     TEXT NOT NULL,
  id_type         TEXT NOT NULL DEFAULT 'national'  -- national (هوية) | iqama (إقامة)
                   CHECK (id_type IN ('national','iqama')),
  applicant_name  TEXT NOT NULL,            -- اسم مقدّم الطلب (صاحب الحساب، ثابت)
  beneficiary_name TEXT NOT NULL DEFAULT '',-- اسم صاحب التصريح
  sponsorship     TEXT NOT NULL DEFAULT 'mab'  -- mab | other
                   CHECK (sponsorship IN ('mab','other')),
  sponsor_company TEXT,                      -- اسم الشركة عند 'other'
  applicant_phone TEXT,
  applicant_email TEXT,
  purpose         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','under_review','info_required','approved','rejected','expired','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  created_by      TEXT REFERENCES users(id),
  assigned_to     TEXT REFERENCES users(id),
  decision_reason TEXT,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_req_status ON permit_requests(status);
CREATE INDEX IF NOT EXISTS idx_req_national ON permit_requests(national_id);
CREATE INDEX IF NOT EXISTS idx_req_assigned ON permit_requests(assigned_to);

-- ----------------------------------------------------------------------
-- التصاريح الصادرة
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permits (
  id               TEXT PRIMARY KEY,       -- UUID
  permit_number    TEXT NOT NULL UNIQUE,   -- PMT-2026-000045
  request_id       TEXT NOT NULL REFERENCES permit_requests(id),
  national_id      TEXT NOT NULL,
  holder_name      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','cancelled')),
  valid_from       TEXT NOT NULL,          -- YYYY-MM-DD
  valid_to         TEXT NOT NULL,          -- YYYY-MM-DD
  issued_by        TEXT NOT NULL REFERENCES users(id),
  issued_at        TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_reason TEXT,
  expiry_notified  INTEGER NOT NULL DEFAULT 0,  -- (قديم) هل أُرسل تنبيه قرب الانتهاء
  last_expiry_notice TEXT,                   -- تاريخ آخر تنبيه قرب الانتهاء (للتذكير اليومي)
  permit_file_id   TEXT,                    -- مرفق ملف التصريح الرسمي المرفوع
  verify_token     TEXT NOT NULL UNIQUE    -- للتحقق العام عبر QR
);
CREATE INDEX IF NOT EXISTS idx_permit_national ON permits(national_id);

-- *** القاعدة الذهبية: تصريح فعّال واحد فقط لكل رقم هوية ***
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_permit_per_id
  ON permits(national_id) WHERE status = 'active';

-- ----------------------------------------------------------------------
-- المرفقات
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES permit_requests(id) ON DELETE CASCADE,
  file_type     TEXT NOT NULL CHECK (file_type IN ('id_image','personal_photo','resident_report','supporting_doc','permit_file')),
  original_name TEXT NOT NULL,
  storage_key   TEXT NOT NULL,             -- اسم الملف على القرص
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  checksum      TEXT NOT NULL,             -- SHA-256
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_att_request ON attachments(request_id);

-- ----------------------------------------------------------------------
-- تاريخ تغيّر الحالات
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  TEXT NOT NULL REFERENCES permit_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  reason      TEXT,
  changed_by  TEXT REFERENCES users(id),
  changed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_request ON status_history(request_id);

-- ----------------------------------------------------------------------
-- سجل التدقيق (append-only مع سلسلة تجزئة)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT,                        -- nullable (النظام)
  actor_name  TEXT,
  action      TEXT NOT NULL,               -- CREATE/UPDATE/APPROVE/REJECT/ISSUE/CANCEL/LOGIN...
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  old_value   TEXT,                        -- JSON
  new_value   TEXT,                        -- JSON
  ip_address  TEXT,
  user_agent  TEXT,
  prev_hash   TEXT,                        -- تجزئة السجل السابق
  hash        TEXT,                        -- تجزئة هذا السجل
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ----------------------------------------------------------------------
-- الإشعارات
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT REFERENCES users(id),
  national_id TEXT,                        -- للمقدّمين بدون حساب
  req_id      TEXT,                        -- الطلب المرتبط (للنقل عند الضغط)
  title       TEXT NOT NULL,
  body        TEXT,
  channel     TEXT NOT NULL DEFAULT 'system',
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- ----------------------------------------------------------------------
-- عدّاد التسلسل (لتوليد أرقام الطلبات/التصاريح بأمان)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequences (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- ======================================================================
--  منصّة واتساب (الدفعة 1: الأساس) — جداول جديدة فقط، لا تمسّ ما سبق
-- ======================================================================

-- ربط رقم/معرّف واتساب بمستخدم موجود
CREATE TABLE IF NOT EXISTS wa_links (
  id         TEXT PRIMARY KEY,
  wa_id      TEXT NOT NULL UNIQUE,          -- الرقم الدولي أو معرّف LID كما يظهر في اللوق
  user_id    TEXT REFERENCES users(id),
  label      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- طابور المهام (يدعم الاسترجاع وإعادة المحاولة)
CREATE TABLE IF NOT EXISTS wa_jobs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  payload      TEXT,                         -- JSON
  status       TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','failed','dead')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after    TEXT NOT NULL DEFAULT (datetime('now')),
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wa_jobs_status ON wa_jobs(status, run_after);

-- المستندات الواردة عبر واتساب (تصنيف + OCR + نص خام للتدقيق)
CREATE TABLE IF NOT EXISTS wa_documents (
  id          TEXT PRIMARY KEY,
  from_id     TEXT,                          -- معرّف المُرسِل (LID/رقم)
  user_id     TEXT REFERENCES users(id),
  wa_msg_id   TEXT,
  kind        TEXT,                          -- national|iqama|personal_photo|resident_report|permit_pdf|unknown
  storage_key TEXT,                          -- اسم الملف على القرص (uploads)
  mime_type   TEXT,
  national_id TEXT,
  ocr_json    TEXT,                          -- JSON للحقول المستخرجة
  raw_text    TEXT,                          -- النص الخام (تدقيق)
  confidence  INTEGER,
  package_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'received',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wa_docs_pkg ON wa_documents(package_id);
CREATE INDEX IF NOT EXISTS idx_wa_docs_nid ON wa_documents(national_id);

-- حزمة مستندات الشخص (Package Builder)
CREATE TABLE IF NOT EXISTS wa_packages (
  id          TEXT PRIMARY KEY,
  national_id TEXT,
  user_id     TEXT REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'collecting'
                CHECK (status IN ('collecting','ready','created','blocked')),
  request_id  TEXT,
  reason      TEXT,
  last_doc_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wa_pkg_nid ON wa_packages(national_id);

-- سجل توزيع التصاريح على المهندسين (الدفعة 4) — دائم، يبقى بعد إعادة التشغيل
-- UNIQUE(permit_id) = حماية من إرسال نفس التصريح مرتين
CREATE TABLE IF NOT EXISTS wa_distributions (
  id               TEXT PRIMARY KEY,
  permit_id        TEXT NOT NULL UNIQUE,
  request_id       TEXT,
  national_id      TEXT,
  permit_number    TEXT,
  request_number   TEXT,
  engineer_user_id TEXT REFERENCES users(id),
  engineer_wa      TEXT,
  storage_key      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','unlinked','failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  sent_at          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wa_dist_status ON wa_distributions(status);
