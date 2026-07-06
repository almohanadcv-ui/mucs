import { db } from '../db/index.js';
import { httpError } from '../middleware/error.js';
import { config } from '../config.js';
import { getRenewalWindowDays } from './settings.js';

// تسميات الحالات بالعربية
export const STATUS_LABELS = {
  new: 'جديد',
  under_review: 'قيد المراجعة',
  info_required: 'بانتظار معلومات إضافية',
  approved: 'معتمد',
  rejected: 'مرفوض',
  expired: 'منتهٍ',
  cancelled: 'ملغي',
};

export const PRIORITY_LABELS = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' };

// الانتقالات المسموحة في آلة الحالات
const TRANSITIONS = {
  new: ['under_review', 'cancelled'],
  under_review: ['info_required', 'approved', 'rejected', 'cancelled'],
  info_required: ['under_review', 'cancelled'],
  approved: ['cancelled'], // بعد الاعتماد يُصدر تصريح؛ الطلب نفسه يبقى معتمداً
  rejected: [],
  expired: [],
  cancelled: [],
};

export function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw httpError(409, `انتقال غير مسموح من "${STATUS_LABELS[from]}" إلى "${STATUS_LABELS[to]}".`);
  }
}

/** يعيد التصريح الفعّال لرقم هوية إن وُجد. */
export function getActivePermit(nationalId) {
  return db
    .prepare(`SELECT * FROM permits WHERE national_id=? AND status='active' LIMIT 1`)
    .get(nationalId);
}

/**
 * هل يمنع التصريح الحالي إنشاء طلب جديد؟
 * يُسمح بالتجديد فقط خلال آخر (renewalWindowDays) أيام قبل الانتهاء.
 * @returns {{ blocked: boolean, permit?: object, renewable?: boolean }}
 */
export function checkPermitBlocking(nationalId) {
  const active = getActivePermit(nationalId);
  if (!active) return { blocked: false };

  const today = new Date();
  const end = new Date(active.valid_to + 'T00:00:00Z');
  const daysLeft = Math.ceil((end - today) / 86400000);

  if (daysLeft > getRenewalWindowDays()) {
    return { blocked: true, permit: active, renewable: false, daysLeft };
  }
  // ضمن نافذة التجديد → مسموح
  return { blocked: false, permit: active, renewable: true, daysLeft };
}

/** يحدّث حالة طلب ويسجّلها في تاريخ الحالات. */
export function changeStatus({ request, toStatus, reason = null, userId = null }) {
  assertTransition(request.status, toStatus);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE permit_requests
       SET status=?, decision_reason=COALESCE(?, decision_reason),
           reviewed_at=?, updated_at=?
     WHERE id=?`
  ).run(toStatus, reason, now, now, request.id);

  db.prepare(
    `INSERT INTO status_history(request_id, from_status, to_status, reason, changed_by)
     VALUES(?,?,?,?,?)`
  ).run(request.id, request.status, toStatus, reason, userId);
}
