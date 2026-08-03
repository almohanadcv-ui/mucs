// عرض حسابات الدخول المخزّنة (قراءة فقط — لا يعدّل شيئاً).
// يُستخدم عند فقدان حساب الدعم، حيث لا يمكن الوصول لواجهة عرض كلمة المرور
// داخل الموقع لأنها نفسها تتطلّب تسجيل دخول بدور «الدعم».
//
// الاستخدام: node src/db/show-logins.js [بريد أو جزء من اسم]
import { db } from './index.js';
import { decryptPw } from '../utils/secret.js';

const filter = (process.argv[2] || '').toLowerCase();

const users = db
  .prepare(
    `SELECT u.full_name, u.email, u.is_active, u.pw_enc, r.code AS role
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY (r.code='support') DESC, r.code, u.full_name`,
  )
  .all()
  .filter(
    (u) =>
      !filter ||
      u.email.toLowerCase().includes(filter) ||
      (u.full_name || '').toLowerCase().includes(filter),
  );

if (!users.length) {
  console.log('لا توجد حسابات مطابقة.');
  process.exit(0);
}

for (const u of users) {
  // pw_enc فارغ يعني حساباً أُنشئ قبل تفعيل التخزين القابل للاسترجاع،
  // و null بعد فكّ التشفير يعني أن JWT_SECRET تغيّر منذ حفظ الكلمة.
  const pw = u.pw_enc ? decryptPw(u.pw_enc) : null;
  console.log('─'.repeat(52));
  console.log('الاسم        :', u.full_name);
  console.log('البريد       :', u.email);
  console.log('الدور        :', u.role, u.is_active ? '' : '(معطّل)');
  console.log(
    'كلمة المرور  :',
    pw ??
      (u.pw_enc
        ? '⚠️ تعذّر فكّ التشفير — تغيّر JWT_SECRET، استخدم set-admin.js'
        : '⚠️ غير مخزّنة — استخدم set-admin.js'),
  );
}
console.log('─'.repeat(52));
process.exit(0);
