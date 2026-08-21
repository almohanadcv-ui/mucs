# بنية منصّة MAB — دليل المهندس

هذا الملف يشرح النظام كاملًا لأي مهندس يستلم بعدنا: التقنية، الملفات، قاعدة
البيانات، تدفّق الدخول، والميزات. **المبدأ الحاكم: العزل** — البوّابة تطبيق مستقل،
لا تلمس أي نظام قائم؛ تعرض الأنظمة الحيّة داخل إطار وتسلّمها هوية عبر SSO.

## التقنية
- **Next.js 15** (App Router) + **React 19** + **TypeScript**.
- **Prisma** + **PostgreSQL** (قاعدة خاصة بالبوّابة).
- **Tailwind v4** للتصميم. **jose** لتوقيع الجلسات/SSO.
- بريد عبر **Microsoft Graph** (نفس تطبيق Azure للأنظمة الأخرى).
- **xlsx** لاستيراد الموظفين. **embedded-postgres** (dev فقط) لقاعدة محلية بلا تثبيت.

## خريطة الملفات
```
mab-portal/
├─ prisma/
│  ├─ schema.prisma         # نموذج البيانات (المصدر الوحيد للحقيقة)
│  ├─ migrations/           # هجرات متتبَّعة (لا تُعدّل يدويًا؛ prisma migrate)
│  ├─ seed.ts               # كتالوج الأنظمة + أول مشرف IT
│  └─ seed-demo.ts          # بيانات تجريبية (npm run seed:demo)
├─ scripts/
│  ├─ dev-db.mjs            # تشغيل Postgres محلي (npm run db:local)
│  └─ backup.sh             # نسخة احتياطية يومية (pg_dump + تدوير)
├─ src/
│  ├─ lib/                  # المنطق المشترك (خادم فقط)
│  │  ├─ db.ts              # عميل Prisma (مفرد)
│  │  ├─ env.ts             # قراءة متغيّرات البيئة + isAllowedEmailDomain
│  │  ├─ crypto.ts          # sha256 / رمز الدخول / مقارنة آمنة
│  │  ├─ jwt.ts             # توقيع/تحقّق جلسة البوّابة + توكن SSO
│  │  ├─ session.ts         # قراءة الجلسة من الكوكي (getSession)
│  │  ├─ email.ts           # Graph + قوالب البريد (sendMail/emailShell)
│  │  ├─ notify.ts          # إشعارات (موقع+بريد): notifyUser/All/Targeted
│  │  ├─ audit.ts           # سجل تدقيق البوّابة (portal_audit_logs)
│  │  ├─ asset-log.ts       # سجل العُهد (asset_logs)
│  │  ├─ access.ts          # أنظمة المستخدم حسب صلاحياته (systemsForUser)
│  │  └─ content.ts         # هل يملك صلاحية نشر الإعلانات/المناسبات؟
│  ├─ app/
│  │  ├─ page.tsx           # الشاشة الرئيسية (AppShell)
│  │  ├─ login/page.tsx     # الدخول (إيميل → كود)
│  │  ├─ admin/page.tsx     # لوحة IT
│  │  └─ api/…              # كل مسارات الـAPI (انظر أدناه)
│  └─ features/             # مكوّنات الواجهة (client)
│     ├─ app-shell.tsx      # الهيكل: شريط الأنظمة (يسار) + منطقة العرض
│     ├─ home-dashboard.tsx # الرئيسية: إعلانات/مناسبات + نشر مستهدف
│     ├─ employees.tsx      # الموظفون: قائمة + ملف + عُهد + استيراد Excel
│     ├─ org-chart.tsx      # المخطط التنظيمي (تنقّل بالنزول)
│     ├─ admin-client.tsx   # لوحة IT (مستخدمون/صلاحيات/أقسام/هيكل)
│     ├─ assistant.tsx      # مساعد AI عائم
│     ├─ notifications-bell.tsx / feedback.tsx / feedback-list.tsx
│     └─ …
├─ middleware.ts            # حماية المسارات (يتطلب جلسة عدا /login)
├─ next.config.ts           # بروكسي /apps/<key> → روابط الأنظمة (embedding)
└─ .env(.example)           # المتغيّرات
```

## قاعدة البيانات (الجداول)
- **portal_users** — هوية البوّابة (بريد، اسم، isActive، **isSuperAdmin**=IT،
  **canManageContent**=نشر) + بيانات وظيفية (jobTitle، departmentId، **managerId**
  علاقة ذاتية، employeeNo، phone، nationalId، hireDate، employmentType، workUnit،
  location).
- **departments** — الأقسام (اسم فريد).
- **systems** / **system_links** — كتالوج الأنظمة + روابطها الفرعية.
- **user_system_access** — أي مستخدم يرى أي نظام (يديره IT).
- **assets** / **asset_logs** — العُهد + **سجلّها الكامل** (create/assign/return/
  update — مين ومتى ووش تغيّر).
- **announcements** — الإعلانات (+ audience: الجمهور المستهدف).
- **events** — المناسبات (أعياد ميلاد…؛ مهمة يومية ترسل تهنئة).
- **notifications** — إشعارات المستخدم (موقع + emailSent).
- **feedback** — الاقتراحات/الشكاوى.
- **login_challenges** / **refresh_tokens** — الدخول والجلسة (تُخزَّن hashes فقط).
- **portal_audit_logs** — سجل تدقيق append-only لكل إجراء إداري.

> **لا حذف نهائي:** الحذف ناعم (deletedAt)؛ السجلات (audit/asset_logs) لا تُحذف.

## الدخول (بلا كلمة مرور)
1. المستخدم يكتب بريده → `POST /api/auth/request-code`.
2. **بوّابتان:** الدومين ضمن `ALLOWED_EMAIL_DOMAINS` **و** المستخدم مسجّل ونشط —
   وإلا لا يُرسَل شيء (ردّ موحّد يمنع التخمين). غير المسجّل لا يدخل إطلاقًا.
3. كود ٦ أرقام يُرسل بالبريد (Graph) → `POST /api/auth/verify-code` → جلسة JWT
   في كوكي httpOnly (12 ساعة).

## SSO للأنظمة (لاحقًا، وبعزل)
`/api/launch/[key]` يُصدر توكن ٦٠ ثانية موقّع بـ`SSO_SECRET`. كل نظام يضيف مسارًا
واحدًا `/sso` يتحقّق منه ويفتح جلسته الداخلية بنفس الإيميل. البروكسي في
`next.config.ts` يجعل الأنظمة على نفس الأصل (`/apps/<key>`) لتُعرض داخل الإطار.

## خريطة الـAPI
- **auth:** request-code, verify-code, logout.
- **admin:** users (GET/POST), users/[id] (PATCH/DELETE), users/[id]/access
  (GET/PUT), departments (GET/POST).
- **employees:** employees (GET), employees/[id] (GET), employees/import (POST).
- **assets:** assets (GET/POST), assets/[id] (GET/PATCH), /assign, /return.
- **content:** announcements (GET/POST مستهدف), events (GET/POST), cron/events (GET).
- **misc:** notifications (GET/PATCH), feedback (GET/POST), org (GET),
  assistant (POST), launch/[systemKey] (GET).

## الصلاحيات
- **isSuperAdmin (IT):** يرى كل الأنظمة + لوحة الإدارة + كل شيء.
- **canManageContent:** ينشر الإعلانات/المناسبات فقط (يمنحه IT من زر «النشر»).
- **user_system_access:** رؤية الأنظمة، لكل مستخدم.
- الأنظمة الداخلية تحتفظ بـRBAC الخاص بها بعد SSO.

## التشغيل
```bash
# محليًا (بلا تثبيت Postgres):
npm install
npm run db:local           # نافذة: قاعدة محلية على 5433
npx prisma migrate deploy  # نافذة أخرى
npm run seed               # الأنظمة + المشرف
npm run seed:demo          # (اختياري) بيانات تجريبية
npm run dev                # http://localhost:3005  (الكود يُطبع بالطرفية)
```
النشر + النسخ الاحتياطي: انظر `README.md`.

## كيف تضيف…
- **قسمًا:** لوحة الإدارة → «الأقسام». أو استيراد Excel يُنشئها تلقائيًا.
- **نظامًا:** أضِف صفًّا في `systems` (seed.ts) + rewrite في `next.config.ts` + مسار
  `/sso` في النظام (نسخة أولًا).
- **حقل موظف:** عدّل `schema.prisma` → `prisma migrate dev` → مرّره في API/UI.
