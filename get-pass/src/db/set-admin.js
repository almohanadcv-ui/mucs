// ضبط/إنشاء حساب مدير (دعم) بكلمة مرور معروفة.
// الاستخدام: node src/db/set-admin.js [email] [password]
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from './index.js';
import { encryptPw } from '../utils/secret.js';

const email = (process.argv[2] || 'admin@pams.local').toLowerCase();
const password = process.argv[3] || 'Admin@12345';

// تأكّد من وجود دور الدعم
let role = db.prepare(`SELECT id FROM roles WHERE code='support'`).get();
if (!role) {
  db.prepare(`INSERT INTO roles(code, name_ar, description) VALUES('support','الدعم','إدارة المستخدمين')`).run();
  role = db.prepare(`SELECT id FROM roles WHERE code='support'`).get();
}

const existing = db.prepare(`SELECT id FROM users WHERE email=?`).get(email);
if (existing) {
  db.prepare(`UPDATE users SET password_hash=?, pw_enc=?, is_active=1, session_id=NULL, role_id=? WHERE id=?`)
    .run(bcrypt.hashSync(password, 10), encryptPw(password), role.id, existing.id);
  console.log('✅ تم تحديث حساب المدير.');
} else {
  db.prepare(`INSERT INTO users(id, full_name, email, password_hash, pw_enc, role_id, is_active)
              VALUES(?,?,?,?,?,?,1)`)
    .run(randomUUID(), 'مدير النظام', email, bcrypt.hashSync(password, 10), encryptPw(password), role.id);
  console.log('✅ تم إنشاء حساب المدير.');
}
console.log('   البريد:', email);
console.log('   كلمة المرور:', password);
process.exit(0);
