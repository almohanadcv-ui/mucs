import { db } from '../db/index.js';

const insert = db.prepare(`
  INSERT INTO notifications(user_id, national_id, req_id, title, body, channel)
  VALUES(@user_id, @national_id, @req_id, @title, @body, @channel)
`);

/**
 * ينشئ إشعاراً داخل النظام. في الإنتاج يمكن ربطه ببريد/SMS فعلي هنا.
 */
export function notify({ userId = null, nationalId = null, reqId = null, title, body = '', channel = 'system' }) {
  insert.run({ user_id: userId, national_id: nationalId, req_id: reqId, title, body, channel });
  // لا نطبع محتوى الإشعار (قد يحوي بيانات شخصية) — نكتفي بالقناة
  console.log(`🔔 [إشعار/${channel}]`);
}

export function listForUser(userId) {
  return db
    .prepare(`SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50`)
    .all(userId);
}

export function markRead(id, userId) {
  db.prepare(`UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`).run(id, userId);
}
