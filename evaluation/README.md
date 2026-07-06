# EMS — نظام إدارة التقييم (Evaluation Management System)

نظام احترافي لإدارة تقييم الموظفين والمتدربين، مبني بمعمارية نظيفة (Clean Architecture)
وجاهز للتوسع كخدمة **SaaS متعددة المستأجرين (Multi-tenant)**.

## المعمارية (Clean Architecture)

```
src/
  core/
    domain/         # الكيانات، الأنواع، الصلاحيات، منطق التقييم (بدون أطر عمل)
    application/    # حالات الاستخدام (services) + DTOs (Zod) لكل وحدة
  infrastructure/
    db/             # Prisma singleton
    security/       # Argon2, JWT, AES-256-GCM, TOTP, rate-limit
    auth/           # الجلسات، الكوكيز، الصلاحيات
    audit/          # سجل العمليات
  app/              # Next.js App Router (صفحات + API routes)
  features/         # مكوّنات واجهة مرتبطة بميزة (auth, shell, dashboard)
  components/ui/    # مكوّنات أساسية (shadcn-style)
  lib/              # أدوات مشتركة (env, http, pagination, api-handler)
```

المبدأ: كل ميزة **إضافية (Additive)** ولا تكسر ما قبلها. `app` يعتمد على `application`
الذي يعتمد على `domain`؛ لا يتسرّب Prisma إلى الـ domain.

## المتطلبات

- Node.js ≥ 22، pnpm ≥ 11
- قاعدة PostgreSQL (محلياً عبر Docker، أو مستضافة مثل Neon)

## التشغيل محلياً

```bash
pnpm install
cp .env.example .env          # ثم عدّل القيم (DATABASE_URL, الأسرار...)

# قاعدة بيانات محلية (اختياري إن لم تستخدم Neon)
pnpm db:up                    # يشغّل Postgres عبر Docker

pnpm db:migrate               # ينشئ الجداول
pnpm db:seed                  # ينشئ أول مستأجر + حساب المدير (من SEED_*)
pnpm dev                      # http://localhost:3000
```

سجّل الدخول بحساب المدير المحدد في `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## الأوامر

| الأمر | الوصف |
|------|-------|
| `pnpm dev` | خادم التطوير |
| `pnpm build` / `pnpm start` | بناء وتشغيل الإنتاج |
| `pnpm typecheck` | فحص الأنواع |
| `pnpm db:migrate` | ترحيلات التطوير |
| `pnpm db:deploy` | تطبيق الترحيلات (إنتاج) |
| `pnpm db:seed` | تهيئة المستأجر والمدير |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | إعادة ضبط القاعدة |

## النشر (Production)

```bash
cp .env.production.example .env.production   # عدّل الأسرار وروابط القاعدة
# ضع شهادات TLS في nginx/certs/{fullchain,privkey}.pem
docker compose -f docker-compose.prod.yml up -d --build
```

- صورة **standalone** متعددة المراحل، تعمل بمستخدم غير جذري.
- `entrypoint.sh` يطبّق `prisma migrate deploy` قبل الإقلاع.
- **Nginx** ينهي TLS ويضيف رؤوس الأمان + تحديد المعدل.
- فحص الصحة: `GET /api/health` (يتحقق من اتصال القاعدة).

## الأمان المطبّق

Argon2id لكلمات المرور · JWT وصول قصير + Refresh دوّار مع كشف إعادة الاستخدام ·
كوكيز httpOnly/Secure/SameSite · RBAC قائم على الصلاحيات · قفل الحساب وتحديد المعدل ·
تشفير الأسرار (AES-256-GCM) · 2FA (TOTP) · رؤوس CSP/HSTS/Clickjacking ·
تحقّق Zod على كل مدخل · استعلامات Prisma آمنة + معاملات · Soft delete · سجل عمليات كامل.

## حالة البناء (Phases)

- ✅ **P1** الأساس · ✅ **P2** طبقة البيانات · ✅ **P3** المصادقة والأمان
- ✅ **P4** النطاق (فروع/أقسام/موظفون/نماذج/١١ نوع سؤال/تدفّق التقييم) — مُختبر end-to-end
- ✅ **P5** لوحة المعلومات + الرسوم البيانية (قيد التوسّع لصفحات الإدارة الكاملة)
- ⏳ **P6** التقارير/التصدير، الإشعارات (UI)، سجل النشاط (UI)، البحث والفلاتر
- ✅ **P7** النشر (Docker/Nginx/Health checks)
