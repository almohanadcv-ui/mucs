/*
 * passwordWatch.js — استعادة/عرض كلمات المرور من قاعدة البيانات مباشرة (بلا أوامر).
 *  - backfillPasswordPlain(): يملأ password_plain للحسابات القائمة (لعرضها مقروءة في DB Browser).
 *  - applyPasswordResets(): إذا كتبت كلمة جديدة في عمود set_password (من DB Browser ثم Write Changes)
 *    يحوّلها النظام إلى كلمة مرور فعلية (تشفير) ويُفرّغ العمود — خلال ثوانٍ، بلا إعادة تشغيل.
 */
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { encryptPw } from '../utils/secret.js';

// أمان: بدل تعبئة عمود كلمة المرور الصريحة، نُفرّغه نهائياً عند الإقلاع
// (لا يُخزَّن أي نص صريح لكلمة المرور بعد الآن). مصدر التحقق هو password_hash،
// وميزة عرض كلمة المرور للدعم تعتمد على pw_enc المشفّر وليست هذه.
export function backfillPasswordPlain() {
  try {
    db.prepare(`UPDATE users SET password_plain=NULL WHERE password_plain IS NOT NULL`).run();
  } catch { /* تجاهل */ }
}

export function applyPasswordResets() {
  const rows = db.prepare(`SELECT id, set_password FROM users WHERE set_password IS NOT NULL AND TRIM(set_password) <> ''`).all();
  for (const r of rows) {
    const pass = String(r.set_password).trim();
    db.prepare(`UPDATE users SET password_hash=?, pw_enc=?, set_password=NULL, session_id=NULL, updated_at=datetime('now') WHERE id=?`)
      .run(bcrypt.hashSync(pass, 10), encryptPw(pass), r.id);
    console.log('🔑 طُبّقت كلمة مرور جديدة من قاعدة البيانات للمستخدم:', r.id);
  }
  return rows.length;
}
