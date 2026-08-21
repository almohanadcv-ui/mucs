# منصّة MAB (MAB Portal)

بوّابة موحّدة لكل أنظمة MAB — دخول واحد بإيميل + كود، وقائمة أنظمة تظهر حسب صلاحيات
كل مستخدم. تطبيق **مستقل تمامًا**، قاعدة بياناته الخاصة، لا يلمس أي نظام قائم.

## متانة النظام (النقاط الخمس)
- **السعة (١٠٠٠+ مستخدم):** PostgreSQL + فهارس على الحقول المستخدمة (email, access, audit)
  + **ترقيم وبحث** في لوحة الإدارة (٢٥/صفحة) — لا تحميل ثقيل مهما كبر العدد.
- **نسخ احتياطي يومي:** `scripts/backup.sh` (pg_dump مضغوط + تدوير ٣٠ يومًا). راجع الأسفل.
- **تنظيم الصلاحيات:** جدول `user_system_access` صريح (مستخدم × نظام) + شبكة في لوحة IT
  تريك صلاحيات كل مستخدم بضغطة، و`portal_audit_logs` يسجّل كل منح/سحب/إنشاء.
- **عدم فقدان البيانات:** حذف **ناعم** (`deletedAt`)، **هجرات متتبَّعة** (migrate deploy — لا db push
  المدمّر)، وسجل تدقيق append-only لا يُحذف.
- **احترافية:** واجهة نظيفة متجاوبة، فصل واضح للطبقات، حراسة صلاحيات، حماية آخر مشرف نظام.

## التشغيل محليًا
```bash
cp .env.example .env   # عبّئ القيم
npm install
npx prisma migrate deploy
npm run seed           # كتالوج الأنظمة + أول مشرف IT (SEED_ADMIN_EMAIL)
npm run dev            # http://localhost:3005
```

## النشر (الخادم)
```bash
cd /var/www/mucs/mab-portal
npm install
npx prisma migrate deploy          # يطبّق الهجرات بأمان (لا يمسّ البيانات)
npm run seed                       # أول مرّة فقط (idempotent)
npm run build
pm2 start "npm run start" --name mab-portal   # أو أضِفه لـpm2 ecosystem
```
ثم في nginx: وجّه دومين البوّابة (نفس الدومين، مثلاً `/`) إلى المنفذ **3005**.

### متغيّرات البيئة المهمّة
- `DATABASE_URL` / `DIRECT_URL` — قاعدة بيانات البوّابة (منفصلة).
- `JWT_SECRET` — سرّ جلسة البوّابة. `SSO_SECRET` — سرّ توكن الدخول الموحّد.
- `GRAPH_*` + `MAIL_FROM` — بريد الكود (نفس بيانات Azure للأنظمة الأخرى).
- `APP_URL` — رابط البوّابة. `SYS_*_URL` — روابط الأنظمة (تُبذَر مرة، وتُعدَّل لاحقًا في القاعدة).

## النسخ الاحتياطي اليومي
```bash
# يدوي
bash scripts/backup.sh
# تلقائي يوميًا (crontab -e):
30 2 * * *  cd /var/www/mucs/mab-portal && bash scripts/backup.sh >> /var/log/mab-portal-backup.log 2>&1
# الاستعادة:
gunzip -c /var/backups/mab-portal/mab-portal_YYYY-MM-DD_HHMMSS.sql.gz | psql "$DATABASE_URL"
```

## الدخول الموحّد (SSO) — لاحقًا وبعزل
كل نظام يضيف **مسارًا واحدًا** `/sso` يتحقّق من توكن البوّابة (سرّ `SSO_SECRET`)، يجد
مستخدمه بنفس الإيميل، ويفتح جلسته الداخلية. **يُجرَّب على نسخة قبل الأصل.** حتى ذلك الحين
تعمل البوّابة كمشغّل/دليل بروابط مباشرة.

## البنية
`src/lib` (db, env, crypto, jwt, email, session, access, audit) · `src/app` (login,
launcher, admin, api) · `prisma` (schema + migrations + seed) · `scripts` (backup).
