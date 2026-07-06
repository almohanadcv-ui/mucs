# نظام إدارة التصاريح والموافقات — PAMS

نظام ويب متكامل لإدارة دورة حياة التصاريح: تقديم الطلب → المراجعة → الاعتماد → إصدار التصريح → الانتهاء/الإلغاء، مع منع وجود أكثر من تصريح فعّال لنفس الهوية، وسجل تدقيق غير قابل للعبث.

## التقنيات
- **الخادم:** Node.js + Express
- **قاعدة البيانات:** SQLite (better-sqlite3) — تدعم الفهرس الفريد الجزئي
- **المصادقة:** JWT عبر كوكي HttpOnly + bcrypt
- **الواجهة:** HTML/CSS/JS عربية RTL بدون أطر (سريعة وخفيفة)

## التشغيل

```bash
npm install        # تثبيت الحزم
cp .env.example .env   # (اختياري) ضبط الإعدادات
npm run seed       # زرع الأدوار والمستخدمين الافتراضيين
npm start          # تشغيل الخادم على http://localhost:4000
```

أوامر أخرى:
- `npm run dev` — تشغيل مع إعادة التحميل التلقائي.
- `npm run reset` — حذف قاعدة البيانات لإعادة البناء (أوقف الخادم أولاً).

## الأدوار (ثلاثة فقط)

- **مقدّم طلب** — يقدّم ويتابع طلباته فقط (الاسم ثابت = اسم الحساب).
- **مراجِع** — يستلم/يترك، يعتمد، يرفض، يطلب معلومات، ويصدر التصاريح.
- **الدعم** — يدير المستخدمين ويطّلع على كل الطلبات والتصاريح وسجل التدقيق والتقارير (دون اتخاذ قرارات).

## حسابات الدخول الافتراضية

| الدور | البريد | كلمة المرور |
|------|--------|-------------|
| الدعم | support@pams.local | Support@123 |
| مراجِع | reviewer@pams.local | Review@123 |
| مقدّم طلب | applicant@pams.local | User@123 |

> صفحة التحقق العامة من التصاريح: `http://localhost:4000/verify.html`

## بنية المشروع

```
src/
  config.js              الإعدادات
  server.js              نقطة التشغيل + مهمة انتهاء التصاريح
  db/
    schema.sql           مخطط قاعدة البيانات الكامل
    index.js             الاتصال + توليد التسلسل الذرّي
    seed.js / reset.js   البذور وإعادة الضبط
  utils/                 nationalId / numbers / jwt / permitDocument
  middleware/            auth / rbac / upload / error
  services/              audit (سلسلة تجزئة) / notifications / workflow (آلة الحالات)
  routes/                auth, requests, permits, users, audit, reports, verify, notifications
public/                  index.html, app.js, styles.css, verify.html
```

## قواعد العمل الأساسية (مطبّقة)

1. **تصريح فعّال واحد لكل هوية** — مفروض على مستوى قاعدة البيانات عبر فهرس فريد جزئي:
   `CREATE UNIQUE INDEX uq_active_permit_per_id ON permits(national_id) WHERE status='active';`
   هذا يمنع التعارض حتى في حالات التزامن، بالإضافة لفحص التطبيق.
2. **رفض الطلب الجديد** لهوية لها تصريح فعّال (أو طلب مفتوح) مع رسالة واضحة.
3. **السماح بطلب جديد** فقط بعد انتهاء أو إلغاء التصريح السابق.
4. **التحقق من رقم الهوية** (نمط سعودي بخوارزمية Luhn أو نمط عام — قابل للضبط عبر `NATIONAL_ID_MODE`).
5. **سجل تدقيق** لكل عملية مع سلسلة تجزئة SHA-256 (tamper-evident) ونقطة فحص للسلامة.

## آلة حالات الطلب

```
جديد → قيد المراجعة → (معتمد → إصدار تصريح) | مرفوض
            ↑↓
     بانتظار معلومات إضافية
التصريح: active → expired (تلقائي) | cancelled (يدوي)
```

## أبرز نقاط الـ API

| الغرض | المسار |
|-------|--------|
| دخول/تسجيل | `POST /api/auth/login` · `POST /api/auth/register` |
| فحص الأهلية | `GET /api/requests/eligibility/:nationalId` |
| إنشاء طلب (multipart) | `POST /api/requests` |
| إجراءات | `POST /api/requests/:id/{assign,request-info,approve,reject}` |
| إصدار/إلغاء تصريح | `POST /api/permits/issue` · `POST /api/permits/:id/cancel` |
| وثيقة التصريح | `GET /api/permits/:id/document` |
| تحقق عام | `GET /api/verify/:token` |
| لوحة التحكم | `GET /api/reports/dashboard` |
| سجل التدقيق + سلامته | `GET /api/audit` · `GET /api/audit/integrity` |

## ملاحظات للإنتاج
- غيّر `JWT_SECRET` وفعّل `NODE_ENV=production` (يفعّل كوكي Secure).
- انقل تخزين الملفات إلى Object Storage وفعّل فحص الفيروسات.
- للتوسّع الكبير: انتقل إلى PostgreSQL (نفس الفهرس الجزئي مدعوم) وأضف صفّ معالجة للإشعارات.
