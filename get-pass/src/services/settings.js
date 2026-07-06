/*
 * settings.js — إعدادات قابلة للتعديل من الموقع (تُخزّن في قاعدة البيانات).
 * كل قيمة لها رجوع تلقائي إلى متغيّر البيئة (.env) إن لم تُضبط من الموقع.
 * يقرأها الكود وقت التشغيل (لا حاجة لإعادة تشغيل غالباً).
 */
import { db } from '../db/index.js';
import { config } from '../config.js';

db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const _get = db.prepare(`SELECT value FROM app_settings WHERE key=?`);
const _set = db.prepare(`INSERT INTO app_settings(key,value) VALUES(?,?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`);

export function getSetting(key) { const r = _get.get(key); return r ? r.value : null; }
export function setSetting(key, value) { _set.run(key, value == null ? null : String(value)); }

const splitNums = (s) => String(s || '').split(',').map((x) => x.replace(/\D/g, '')).filter(Boolean);

/** عتبة التصدير التلقائي (عدد). */
export function getExportBatchSize() {
  const v = getSetting('exportBatchSize');
  const n = Number(v);
  return (v != null && Number.isFinite(n) && n >= 1) ? Math.floor(n) : config.wa.exportBatchSize;
}

/** كل معرّفات المراجِع (رقم + LID) للتعرّف على الوارد. */
export function getReviewerIds() {
  const v = getSetting('reviewerIds');
  return v != null ? splitNums(v) : config.wa.reviewerIds;
}

/** رقم المراجِع للإرسال (يُفضّل رقم الجوال على LID الطويل). */
export function getReviewerNumber() {
  const ids = getReviewerIds();
  return ids.find((x) => /^\d{10,13}$/.test(x)) || ids[0] || config.wa.reviewerNumber;
}

/** الأرقام المسموح لها بالإرسال للوكيل. */
export function getAllowlist() {
  const v = getSetting('allowlist');
  return v != null ? splitNums(v) : config.whatsapp.allowlist;
}

/** مستلمو ملف Excel للتصدير (إن لم يُحدَّدوا → أول رقم مراجِع). */
export function getExportRecipients() {
  const v = getSetting('exportRecipients');
  const list = v != null ? splitNums(v) : [];
  return list.length ? list : [getReviewerNumber()].filter(Boolean);
}

// نص التعهّد (قابل للتعديل من الموقع) — {name} يُستبدل باسم الموقّع
const DEFAULT_UNDERTAKING_TITLE = 'نموذج استلام عهدة كمبيوتر';
const DEFAULT_UNDERTAKING_BODY = 'أقر أنا {name}:\n\nبأنني أتحمل جميع المشاكل، وأتحمل أخطاءً تتعلق بإدخال بيانات أو أسماء خاطئة وغير صحيحة، وشركة ماب (MAB) غير مسؤولة أبداً عن أي شيء.';
export function getUndertaking() {
  return {
    title: getSetting('undertaking_title') || DEFAULT_UNDERTAKING_TITLE,
    body: getSetting('undertaking_body') || DEFAULT_UNDERTAKING_BODY,
  };
}

// نافذة استقبال الطلبات (HH:MM) — قابلة للتعديل
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? (+m[1] * 60 + +m[2]) : null; };
export function getSubmissionWindow() {
  const start = getSetting('submit_start') || '08:00';
  const end = getSetting('submit_end') || '13:00';
  return { start, end, startMin: toMin(start) ?? 480, endMin: toMin(end) ?? 780 };
}

/** عدد الأيام قبل الانتهاء التي يُسمح فيها بالتجديد (قابل للتعديل). */
export function getRenewalWindowDays() {
  const n = Number(getSetting('renewal_window_days'));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : (config.renewalWindowDays || 5);
}

/** القيم الحالية لعرضها/تعديلها من الموقع. */
export function publicSettings() {
  const u = getUndertaking();
  const w = getSubmissionWindow();
  return {
    exportBatchSize: getExportBatchSize(),
    reviewerIds: getReviewerIds().join(','),
    allowlist: getAllowlist().join(','),
    exportRecipients: getSetting('exportRecipients') || '', // فارغ = يُرسل لأول رقم مراجِع
    undertakingTitle: u.title,
    undertakingBody: u.body,
    submitStart: w.start,
    submitEnd: w.end,
    renewalWindowDays: getRenewalWindowDays(),
  };
}
