/*
 * linking.js — ربط رقم/معرّف واتساب بمستخدم موجود (الدفعة 1)
 * --------------------------------------------------------
 * يخزّن العلاقة في جدول wa_links. تستخدمه الدفعات اللاحقة لنسب الطلبات للمستخدم الصحيح.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';

/** يعيد user_id المرتبط بمعرّف واتساب، أو null. */
export function resolveUserId(waId) {
  if (!waId) return null;
  const row = db.prepare(`SELECT user_id FROM wa_links WHERE wa_id=?`).get(String(waId));
  return row?.user_id || null;
}

/** يعيد رقم واتساب للإرسال للمستخدم — يفضّل رقم الجوال (≤13 خانة) على LID الطويل. */
export function resolveWaId(userId) {
  if (!userId) return null;
  const rows = db.prepare(`SELECT wa_id FROM wa_links WHERE user_id=? ORDER BY created_at DESC`).all(String(userId));
  if (!rows.length) return null;
  const phone = rows.find((r) => /^\d{10,13}$/.test(String(r.wa_id)));
  return (phone || rows[0]).wa_id;
}

/** يربط معرّف واتساب بمستخدم (يحدّث إن كان موجوداً). */
export function addLink(waId, userId, label = null) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO wa_links(id, wa_id, user_id, label) VALUES(?,?,?,?)
    ON CONFLICT(wa_id) DO UPDATE SET user_id=excluded.user_id, label=excluded.label
  `).run(id, String(waId), userId, label);
  return id;
}

/** يحذف ربطاً. */
export function removeLink(waId) {
  return db.prepare(`DELETE FROM wa_links WHERE wa_id=?`).run(String(waId)).changes;
}

/** قائمة الروابط مع اسم المستخدم. */
export function listLinks() {
  return db.prepare(`
    SELECT l.wa_id, l.label, l.user_id, l.created_at, u.full_name, u.email, r.code AS role
    FROM wa_links l
    LEFT JOIN users u ON u.id = l.user_id
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY l.created_at DESC
  `).all();
}
