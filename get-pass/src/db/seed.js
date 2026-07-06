import bcrypt from 'bcryptjs';
import crypto, { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';
import { encryptPw } from '../utils/secret.js';
import { seedPermissions } from '../services/permissions.js';

const isProd = (process.env.NODE_ENV || 'development') === 'production';

// الأدوار الأساسية
const roles = [
  { code: 'applicant', name_ar: 'مقدّم طلب', description: 'يقدّم الطلبات ويتابعها' },
  { code: 'reviewer', name_ar: 'مراجِع', description: 'يراجع الطلبات ويعتمدها ويصدر التصاريح' },
  { code: 'supervisor', name_ar: 'المشرف', description: 'يتابع مقدّمي الطلبات والنشاط والأداء' },
  { code: 'general_management', name_ar: 'الإدارة العامة', description: 'لوحة مؤشرات وتحليلات لحظية بدون مراجعة الطلبات' },
  { code: 'support', name_ar: 'الدعم', description: 'إدارة المستخدمين والإشراف وسجل التدقيق' },
];

// في الإنتاج: حساب دعم واحد فقط (كلمة مروره من البيئة أو عشوائية تُطبع مرة واحدة).
// في التطوير: حسابات تجريبية للاختبار.
const adminPassword = process.env.SEED_SUPPORT_PASSWORD || (isProd ? crypto.randomBytes(9).toString('base64url') : 'Support@123');
const users = isProd
  ? [{ full_name: 'مدير النظام', email: (process.env.SEED_SUPPORT_EMAIL || 'admin@pams.local').toLowerCase(), role: 'support', password: adminPassword, _generated: !process.env.SEED_SUPPORT_PASSWORD }]
  : [
      { full_name: 'فريق الدعم', email: 'support@pams.local', role: 'support', password: 'Support@123' },
      { full_name: 'سارة المراجِعة', email: 'reviewer@pams.local', role: 'reviewer', password: 'Review@123' },
      { full_name: 'نورة المشرفة', email: 'supervisor@pams.local', role: 'supervisor', password: 'Supervisor@123' },
      { full_name: 'الإدارة العامة', email: 'management@pams.local', role: 'general_management', password: 'Manage@123' },
      { full_name: 'عبدالله المتقدّم', email: 'applicant@pams.local', role: 'applicant', password: 'User@123', national_id: '1000000008' },
    ];

export function ensureAccessModel() {
  const insertRole = db.prepare(
    `INSERT INTO roles(code, name_ar, description) VALUES(@code, @name_ar, @description)
     ON CONFLICT(code) DO UPDATE SET name_ar=excluded.name_ar, description=excluded.description`
  );
  for (const r of roles) insertRole.run(r);
  seedPermissions();
}

export function seedDatabase({ silent = false } = {}) {
  ensureAccessModel();
  const roleId = (code) => db.prepare(`SELECT id FROM roles WHERE code=?`).get(code).id;

  const insertUser = db.prepare(
    `INSERT INTO users(id, full_name, email, phone, national_id, password_hash, pw_enc, role_id, is_active)
     VALUES(@id, @full_name, @email, @phone, @national_id, @password_hash, @pw_enc, @role_id, 1)
     ON CONFLICT(email) DO UPDATE SET
       full_name=excluded.full_name, password_hash=excluded.password_hash, pw_enc=excluded.pw_enc, role_id=excluded.role_id`
  );
  for (const u of users) {
    insertUser.run({
      id: randomUUID(),
      full_name: u.full_name,
      email: u.email.toLowerCase(),
      phone: u.phone || null,
      national_id: u.national_id || null,
      password_hash: bcrypt.hashSync(u.password, 10),
      pw_enc: encryptPw(u.password),
      role_id: roleId(u.role),
    });
  }
  // في الإنتاج: اطبع كلمة مرور المدير المُولّدة مرة واحدة فقط (إن لم تُضبط من البيئة)
  const gen = users.find((u) => u._generated);
  if (isProd && gen) {
    console.log('================ حساب المدير الأولي (احفظه الآن وغيّره فوراً) ================');
    console.log(`   البريد: ${gen.email}`);
    console.log(`   كلمة المرور: ${gen.password}`);
    console.log('=============================================================================');
  }
  if (!silent && !isProd) {
    console.log('✅ تم زرع البيانات الأولية بنجاح.');
    console.log('\n   حسابات الدخول الافتراضية (التطوير فقط):');
    console.table(users.map((u) => ({ البريد: u.email, الدور: u.role, كلمة_المرور: u.password })));
  }
}

// زرع تلقائي عند أول إقلاع إذا كانت قاعدة البيانات فارغة (للنشر)
export function ensureSeed() {
  const count = db.prepare(`SELECT COUNT(*) c FROM users`).get().c;
  if (count === 0) { seedDatabase({ silent: true }); console.log('🌱 تم الزرع التلقائي للحسابات الافتراضية (قاعدة بيانات جديدة).'); }
  else ensureAccessModel();
}

// التشغيل المباشر: node src/db/seed.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase();
  process.exit(0);
}
