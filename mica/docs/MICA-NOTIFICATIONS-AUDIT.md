# MICA — تقرير تدقيق منظومة الإشعارات (Phase 0)

> **الحالة:** تدقيق فقط. لم يُعدَّل أي ملف وظيفي في هذه المرحلة.
> **التاريخ:** 2026-07-21
> **النطاق:** `mica/` حصرًا. لم تُفحص ولم تُلمس أنظمة `evaluation` أو `get-pass` أو `it-support` أو `mcs-landing`.

---

## 0. الخلاصة التنفيذية — تصحيح جوهري للفرضية

الطلب انطلق من أنه **«لا توجد منظومة إشعارات عامة أو بريدية متكاملة»**.

هذا **غير دقيق**. المشروع يحتوي بالفعل على:

| المكوّن | الحالة | الملف |
|---|---|---|
| وحدة إشعارات متعددة القنوات | ✅ تعمل | `src/modules/notifications/` |
| طابور BullMQ للبريد + Redis | ✅ يعمل | `src/queues/bullmq.module.ts` |
| Worker بريد مع إعادة محاولة أسّية | ✅ يعمل | `src/queues/email.processor.ts` |
| مرسِل SMTP عبر nodemailer | ✅ يعمل | `src/queues/mailer.service.ts` |
| جدول `Notification` مع حالات | ✅ موجود | `prisma/schema.prisma:768` |
| إشعار عند رفع الفاتورة | ✅ موجود | `invoices.service.ts:82` |
| إشعار عند الاعتماد/الرفض | ✅ موجود | `invoices.service.ts:178` |
| Audit Log عام لكل طلب مُعدِّل | ✅ يعمل | `common/interceptors/audit-log.interceptor.ts` |

**النتيجة:** المطلوب ليس بناء منظومة من الصفر، بل **سدّ ثغرات محددة في منظومة قائمة**. بناء `NotificationEvent` / `NotificationDispatcher` / `NotificationWorker` جديدة بالكامل — كما ورد في الطلب — سيُنتج **طبقة ثانية موازية** للقائمة، وهو بالضبط ما تمنعه قاعدة «بأقل تغييرات ممكنة».

التوصية المعمارية مفصّلة في القسم 12.

---

## 1. التقنيات الموجودة فعليًا

| البند | القيمة | المصدر |
|---|---|---|
| نوع المشروع | **Monorepo** (pnpm workspaces + Turborepo 2.10) | `pnpm-workspace.yaml`, `turbo.json` |
| Backend | **NestJS 10** (Express platform) | `apps/api/package.json` |
| Frontend | **Next.js** App Router + React Query + Tailwind + shadcn/ui | `apps/web/` |
| قاعدة البيانات | **PostgreSQL** | `DATABASE_URL` في `.env.example` |
| ORM | **Prisma 6.1** | `apps/api/prisma/schema.prisma` |
| الطوابير | **BullMQ 5.34** + `@nestjs/bullmq` | `src/queues/bullmq.module.ts` |
| Redis | **ioredis 5.4** — مستخدم للطوابير وكاش الصلاحيات ولوحة المعلومات | `src/redis/redis.module.ts` |
| البريد | **nodemailer 6.9** عبر SMTP | `src/queues/mailer.service.ts` |
| المهام المجدولة | `@nestjs/schedule` — مستخدم في وحدة التذكيرات | `src/modules/reminders/` |
| Realtime | Socket.io عبر `notifications.gateway.ts` | `src/modules/notifications/` |
| التحقق | Zod عبر `ZodValidationPipe` | `src/common/pipes/` |
| المصادقة | JWT (access header + refresh cookie) + argon2 | `src/modules/auth/` |
| التوثيق | Swagger (`@nestjs/swagger`) | `apps/api/src/main.ts` |
| الحزم المشتركة | `@mica-mab/shared-types` (Zod schemas + أنواع) | `packages/shared-types/` |

**Microsoft Graph: غير موجود.** لا توجد أي تبعية أو إعداد لـ Microsoft 365 / Graph / Entra ID في المشروع.

---

## 2. بنية المشروع

```
mica/
├─ apps/
│  ├─ api/          @mica-mab/api    — NestJS
│  │  ├─ prisma/    schema.prisma + migrations + seed/
│  │  └─ src/
│  │     ├─ common/      guards, interceptors, pipes, decorators, permission-cache
│  │     ├─ config/      app|database|jwt|redis|smtp|storage|backup .config.ts
│  │     ├─ database/    prisma.service
│  │     ├─ queues/      bullmq.module | email.processor | mailer.service
│  │     ├─ redis/
│  │     ├─ storage/     storage-provider.interface (local | s3)
│  │     └─ modules/     23 وحدة (invoices, notifications, maintenance, …)
│  └─ web/          @mica-mab/web    — Next.js
│     ├─ app/(dashboard)/…
│     ├─ features/<domain>/api.ts + مكوّنات
│     └─ messages/{ar,en}.json
└─ packages/
   ├─ shared-types/  permissions.ts, roles.ts, invoices, maintenance…
   └─ config/        إعدادات eslint/ts مشتركة
```

**نمط الوحدة الواحدة:** `x.module.ts` + `x.controller.ts` + `x.service.ts`. المتحكّم رقيق: تحقق Zod + `@Permissions(...)` + استدعاء الخدمة. المنطق كله في الخدمة.

---

## 3. الملفات المسؤولة عن الفواتير

| الملف | الدور |
|---|---|
| `apps/api/src/modules/invoices/invoices.controller.ts` | 8 مسارات |
| `apps/api/src/modules/invoices/invoices.service.ts` | كل منطق الفواتير |
| `apps/api/src/modules/invoices/invoices.module.ts` | الربط |
| `packages/shared-types/src/…` | `createInvoiceSchema`, `acceptInvoiceSchema`, `rejectInvoiceSchema`, `INVOICE_ALLOWED_MIME_TYPES` |
| `apps/web/features/invoices/api.ts` | عميل HTTP |
| `apps/web/features/invoices/upload-invoice-dialog.tsx` | الرفع |
| `apps/web/features/invoices/reject-invoice-dialog.tsx` | الرفض |
| `apps/web/features/invoices/invoice-delete-button.tsx` | الحذف |
| `apps/web/app/(dashboard)/invoices/page.tsx` | القائمة (لا توجد صفحة تفاصيل) |

> **ملاحظة:** لا توجد صفحة تفاصيل فاتورة (`/invoices/[id]`). هذه فجوة مباشرة أمام متطلّب «زر عرض الفاتورة» في البريد — انظر القسم 11.

---

## 4. نماذج قاعدة البيانات ذات العلاقة

### `Invoice` (`schema.prisma:379`)

```prisma
id, vehicleId, amount Decimal(12,2), description?, workshopName?,
invoiceDate?, fileKey, fileName, mimeType, sizeBytes,
status InvoiceStatus @default(PENDING),
rejectionReason?, decisionNotes?, decidedById?, decidedAt?,
createdAt, updatedAt, deletedAt?, createdById?, updatedById?
vehicle Vehicle @relation(...)
```

**ملاحظات حرجة:**

1. **`createdById` و `decidedById` و `updatedById` حقول `String?` مجرّدة — بلا علاقة FK إلى `User`.** لا يمكن عمل `include: { createdBy: true }`؛ يلزم استعلام منفصل. وليس هناك ما يمنع قيمة يتيمة.
2. **لا يوجد `branchId` على الفاتورة.** الفرع يُستنتج عبر `vehicle.branchId` فقط.
3. **لا يوجد حقل `version`** — لا قفل تفاؤلي.
4. **لا علاقة بين `Invoice` و `MaintenanceRequest`.** الفاتورة مرتبطة بالمركبة مباشرة.

### `Notification` (`schema.prisma:768`)

```prisma
id, recipientId, type String, title, body, payload Json?,
channel NotificationChannel @default(IN_APP),
status NotificationStatus @default(PENDING),
readAt?, sentAt?, createdAt
recipient User @relation(onDelete: Cascade)
```

**ينقصه لمتطلبات المرحلة:** `attempts`, `providerMessageId`, `lastError`, `nextAttemptAt`, `failedAt`, `idempotencyKey`, `systemKey`, `correlationId`.

### `AuditLog` (`schema.prisma:790`)

append-only بالتصميم (لا `updatedAt` ولا حذف ناعم). يلتقط `userId, action, entityType, entityId, ipAddress, userAgent, method, path, statusCode, requestId, changesBefore?, changesAfter?, metadata?`.

### `Vehicle`

يحمل `branchId` — وهو الجسر الوحيد بين الفاتورة والهيكل التنظيمي.

---

## 5. حالات الفاتورة الحالية

```prisma
enum InvoiceStatus {
  PENDING   // بانتظار الاعتماد ← الحالة الابتدائية
  ACCEPTED  // مقبولة
  REJECTED  // مرفوضة
}
```

ثلاث حالات فقط، والانتقال **من `PENDING` فقط**. **لا حاجة إلى أي migration لتغيير الحالات** — الحالة التي تعني «انتظار الاعتماد» موجودة ومسمّاة.

> تنبيه اصطلاحي: الحالة اسمها `ACCEPTED` لا `APPROVED`. أسماء الأحداث المطلوبة (`MICA_INVOICE_APPROVED`) لا تطابق مفردات المشروع. يجب حسم ذلك قبل Phase 2 (انظر القسم 15).

`MaintenanceStatus` منفصل تمامًا (12 حالة) ولا علاقة له بالفواتير.

---

## 6. مسارات رفع واعتماد ورفض الفاتورة

| الطريقة | المسار | الصلاحية | الخدمة |
|---|---|---|---|
| GET | `/invoices` | `invoices:view` | `list()` |
| GET | `/invoices/deleted` | `invoices:delete` | `listDeleted()` |
| POST | `/invoices/:id/restore` | `invoices:delete` | `restore()` |
| GET | `/invoices/:id` | `invoices:view` | `findById()` |
| GET | `/invoices/:id/file` | `invoices:view` | `getFile()` |
| **POST** | **`/invoices`** | **`invoices:create`** | **`create()`** — multipart, حد 20MB، PDF/PNG/JPG |
| **POST** | **`/invoices/:id/accept`** | **`invoices:approve`** | **`accept()`** |
| **POST** | **`/invoices/:id/reject`** | **`invoices:reject`** | **`reject()`** |
| DELETE | `/invoices/:id` | `invoices:delete` | `remove()` — حذف ناعم |

سبب الرفض **إلزامي بالفعل** عبر `rejectInvoiceSchema`.

---

## 7. كيف يُحدَّد المدير المسؤول

`invoices.service.ts:82`:

```ts
const approverIds = await this.permissionCache.findUserIdsWithPermission("invoices:approve");
```

`permission-cache.service.ts:64` تُرجع كل `userId` لديه دور يملك المفتاح — **بلا أي تصفية حسب الفرع أو القسم**، ثم يُستثنى الرافع نفسه.

**واقع الأدوار** (`prisma/seed/roles.seed.ts`): أربعة أدوار بنطاق `PermissionScope.ALL`، والتعليق في الملف يوضّح أن هذا **نشر بورشة واحدة بلا عزل بيانات بين الفروع**. `invoices:approve` يملكه: **Technical Support** و **Management**.

**الخلاصة:** «المدير المخوّل» = كل من يملك `invoices:approve`. لا يوجد حاليًا مفهوم «مدير الفرع المسؤول عن هذه الفاتورة». متطلّب **«يجب ألا يُرسل البريد إلى مدير غير مخول برؤية الفاتورة»** مُستوفى تلقائيًا اليوم لأن النطاق `ALL` — أي مخوَّل بالاعتماد مخوَّل بالرؤية. أي تضييق حسب الفرع = **تغيير سلوك قائم** يحتاج قرارًا صريحًا منك.

> يوجد `DEFAULT_APPROVAL_TIERS` (عتبات 0 / 5000 / 20000 بمستويات اعتماد) في `workflow.service.ts:17` لكنه **غير مستخدم** (يظهر كتحذير lint). أي منطق تصعيد حسب المبلغ **غير مطبَّق**.

---

## 8. كيف تُربط الفاتورة بالميكانيكي

عبر **`Invoice.createdById`** التي تُضبط في `create()` من `actingUserId`.

`notifyCreator()` تستخدمها لإشعار الرافع. وإن كانت `null` **تخرج بصمت بلا أي تسجيل** (`invoices.service.ts:182`) — انظر المخاطر.

لا يوجد `assignedMechanicId` ولا ربط بـ `MaintenanceRequest.assignedToId`.

---

## 9. المصادقة والجلسات والصلاحيات

- **Access token:** JWT في ترويسة `Authorization: Bearer` — يحفظه العميل في الذاكرة ويُرسَل عبر معترض axios.
- **Refresh token:** كوكي `httpOnly`, `sameSite: "lax"`, `secure` في الإنتاج فقط (`auth.controller.ts:196`).
- **الحُرّاس:** `JwtAuthGuard` عام + `PermissionsGuard` عبر `@Permissions("resource:action")`.
- **الكاش:** `PermissionCacheService` على Redis، تُبطَّل عند تغيير الأدوار.
- **الصلاحيات بيانات لا كود:** تُولَّد من `packages/shared-types/src/permissions.ts` وتُزرع في جدول `Permission`.
- **CSRF: لا توجد أي حماية.** غير مطلوبة اليوم لأن الـ API يعتمد Bearer header لا كوكي الجلسة — والكوكي الوحيد (`refresh`) محمي بـ `sameSite: lax`.

> **أثر مباشر على Phase 4:** أي صفحة تأكيد تعتمد كوكي الجلسة ستُدخل سطح CSRF غير موجود اليوم. الأسلم أن تسير صفحة التأكيد على نفس مسار Bearer الحالي.

---

## 10. Logging و Audit Logs

- **Audit:** `AuditLogInterceptor` مسجَّل عالميًا كـ `APP_INTERCEPTOR`. يلتقط **كل** طلب `POST/PATCH/PUT/DELETE` (عدا `/auth/login|refresh|logout` و `/health`)، ناجحًا كان أو فاشلًا، ويكتب بلا حجب للاستجابة. يحجب `passwordHash`, `twoFactorSecret`, `tokenHash`.
- **النتيجة:** كل اعتماد ورفض **يُسجَّل تلقائيًا اليوم** — بما في ذلك المحاولات الفاشلة (يُسجَّل `statusCode`).
- **Logging:** `Logger` من NestJS. لا يوجد logger منظَّم (pino/winston) ولا metrics ولا OpenTelemetry.

---

## 11. المخاطر المحتملة

مرتّبة حسب الخطورة. **كلها قائمة اليوم قبل أي تعديل.**

### 🔴 خ-1 — سباق حقيقي في الاعتماد/الرفض

`accept()` و `reject()` تنفّذان **فحصًا ثم فعلًا** بلا شرط في التحديث:

```ts
await this.assertPending(id);          // قراءة
const updated = await this.prisma.invoice.update({ where: { id }, … });  // كتابة
```

مديران يضغطان في نفس اللحظة: كلاهما يجتاز `assertPending`، وكلاهما يكتب. **الأخير يفوز بصمت**، ويصل الميكانيكي إشعاران متناقضان. لا Transaction ولا `updateMany` بشرط الحالة ولا قفل.

### 🔴 خ-2 — حقن HTML في البريد

`email-channel.adapter.ts:44`:

```ts
html: `<p>${notification.body}</p>`
```

و `body` يتضمّن **سبب الرفض الذي يكتبه المستخدم** و `workshopName`. لا يوجد أي هروب (escaping). محتوى يتحكّم فيه المستخدم يُحقن مباشرة في HTML يُرسل بريدًا.

### 🟠 خ-3 — لا توجد فكرة idempotency إطلاقًا

لا `idempotencyKey` ولا قيد فريد. إعادة إرسال `POST /invoices` أو نقرة مزدوجة تُنشئ فاتورة ثانية وموجة إشعارات ثانية.

### 🟠 خ-4 — ضياع صامت عند غياب الرافع

`notifyCreator` تخرج بلا سجل إذا كانت `createdById` فارغة. لا سجل «SKIPPED». ولأنها ليست FK، قد تشير إلى مستخدم محذوف.

### 🟠 خ-5 — عدّاد المحاولات لا يُحفظ

`email.processor.ts` يكتب `SENT` أو `FAILED` فقط. لا `attempts` ولا `lastError` ولا `providerMessageId` في قاعدة البيانات — تشخيص أي فشل يتطلّب قراءة سجلات Redis.

### 🟠 خ-6 — `onFailed` يمكن أن تفشل بصمت

إن نجح الإرسال وفشل تحديث `status`، يبقى الإشعار `PENDING` للأبد. لا مصالحة.

### 🟡 خ-7 — لا اختبارات

`pnpm test` **يفشل**: `No tests found, exiting with code 1`. صفر ملفات `.spec.ts`، ولا `jest.config`، ولا مجلد `test/` رغم وجود سكربت `test:e2e` يشير إلى `./test/jest-e2e.json` **غير موجود**.

### 🟡 خ-8 — `pnpm lint` يفشل حاليًا

3 تحذيرات مع `--max-warnings 0`، اثنان منها ثوابت الاعتماد المتدرّج غير المستخدمة.

### 🟡 خ-9 — لا صفحة تفاصيل فاتورة

«زر عرض الفاتورة» لا يوجد له وجهة. المتاح فقط `GET /invoices/:id/file` (تنزيل الملف الخام).

### 🟡 خ-10 — كلمة مرور SMTP في قاعدة البيانات

`settings.getSmtpWithSecret()` تقرأ الاعتماد من جدول `Setting`. **يجب التحقق من كونها مشفَّرة** قبل الاعتماد عليها.

### 🟡 خ-11 — إعادة بناء الـ transporter في كل رسالة

`buildTransport()` تُستدعى في كل إرسال — قرار مقصود وموثَّق (لتفعيل تغيير الاعتماد فورًا)، لكنه يمنع تجميع الاتصالات ويضاعف مصافحات TLS تحت الضغط.

### ⚪ خ-12 — Redis في الإنتاج غير مؤكَّد

`scripts/deploy.sh` لا يذكر Redis. إن لم يكن Redis يعمل على الخادم، فطابور البريد **لا يعمل أصلًا اليوم** والإشعارات البريدية صامتة. **لم أتمكن من التحقق — الوصول إلى الخادم محجوب في هذه الجلسة.** هذا أول ما يجب التأكد منه.

---

## 12. القرار المعماري

### التوصية: التوسعة على المنظومة القائمة، لا بناء موازية

| الطلب | الواقع | القرار |
|---|---|---|
| `NotificationEvent` | `Notification` موجود | **توسعة بالحقول الناقصة** |
| `NotificationDelivery` | مدموج في `Notification` | **فصله في جدول `NotificationDelivery`** |
| `NotificationDispatcher` | `NotificationsService.notify()` | **إبقاؤه، إضافة idempotency** |
| `NotificationWorker` | `EmailProcessor` | **إبقاؤه، إضافة حالات ومحاولات** |
| `NotificationProvider` | `MailerService` | **استخلاص واجهة `EmailProvider`** |
| `EmailTemplate` | غير موجود | **جديد** |
| `NotificationAuditLog` | `AuditLog` عام | **إعادة استخدام** |
| Outbox Pattern | Redis + BullMQ موجودان | **غير مطلوب** — انظر أدناه |

### لماذا لا Outbox

الطلب حدّد: «إذا لم يوجد Redis ولا Queue، استخدم Transactional Outbox». **Redis و BullMQ موجودان ويعملان.** فالمسار المحدَّد هو BullMQ.

لكن يبقى ثغرة حقيقية: `notify()` تُستدعى **بعد** كتابة الفاتورة وخارج أي transaction. لو سقط العمليّة بين الاثنين، يضيع الإشعار بلا أثر. الحل الأخف: كتابة صف `Notification` بحالة `PENDING` **داخل** transaction الفاتورة، ثم إضافة مهمة الطابور بعد نجاح الـ commit — مع Worker مصالحة دوري يلتقط أي `PENDING` قديم لم يدخل الطابور. هذا يعطي ضمانة الـ outbox بلا جدول ثانٍ ولا آلية استقصاء ثانية.

### `systemKey`

يُضاف `systemKey String @default("MICA")` على `Notification`. عمود واحد، لا جدول أنظمة، لا تكامل مع أي نظام آخر الآن.

### Outlook Actionable Messages — الحكم

**غير قابل للتطبيق مباشرة اليوم.** الأسباب حقائق لا آراء:

1. **لا يوجد أي تكامل مع Microsoft** في المشروع — لا `@azure/*`، لا `@microsoft/microsoft-graph-client`، لا إعداد Entra.
2. **يتطلّب تسجيلًا خارجيًا** لـ originator عبر Actionable Email Developer Dashboard — قرار تنظيمي لا برمجي.
3. **يتطلّب نطاقًا حقيقيًا وHTTPS** ونقطة نهاية عامة موثَّقة.
4. **يتطلّب مستأجر Microsoft 365** ولم أجد ما يثبت وجوده.
5. **لا يعمل خارج Outlook** — Gmail وعملاء آخرون يحتاجون بديلًا على أي حال.

**المسار الصحيح:** المستوى الأول (رابط قرار آمن) **أولًا** — وهو يعمل مع أي عميل بريد. المستوى الثاني يُبنى فوقه لاحقًا، ولا يُبدأ إلا بعد تأكيد المستأجر والنطاق وموافقة تسجيل originator. توثيق المتطلبات الخارجية في `docs/MICA-OUTLOOK-ACTIONS-SETUP.md` بلا أي قيم وهمية.

---

## 13. الملفات المتوقّع تعديلها

| الملف | السبب |
|---|---|
| `apps/api/prisma/schema.prisma` | توسعة `Notification`، جدول `NotificationDelivery`، جدول رموز الإجراء |
| `apps/api/src/modules/invoices/invoices.service.ts` | **تحديث شرطي** لإصلاح خ-1؛ نقل الإشعار داخل الـ transaction |
| `apps/api/src/modules/notifications/adapters/email-channel.adapter.ts` | هروب HTML (خ-2)، قوالب، idempotency |
| `apps/api/src/queues/mailer.service.ts` | واجهة provider، نص بديل، ترويسات |
| `apps/api/src/queues/email.processor.ts` | تسجيل المحاولات والأخطاء ومعرّف الرسالة |
| `apps/api/src/queues/bullmq.module.ts` | حدود معدّل وتزامن قابلة للضبط |
| `apps/api/src/config/smtp.config.ts` | متغيّرات `MICA_MAIL_*` |
| `apps/api/.env.example` | توثيق المتغيّرات الجديدة |
| `apps/api/package.json` | `jest.config` (لا توجد بنية اختبار) |
| `apps/web/messages/{ar,en}.json` | نصوص صفحة التأكيد |

**لن يُعدَّل:** أي مسار قائم، أو مخطط Zod قائم، أو نظام المصادقة، أو أي واجهة قائمة.

---

## 14. الملفات الجديدة المقترحة

```
apps/api/src/modules/notifications/
  templates/invoice-submitted.template.ts
  templates/invoice-decided.template.ts
  templates/layout.ts                 ← غلاف RTL متوافق مع Outlook + هروب HTML
  providers/email-provider.interface.ts
  providers/smtp-email.provider.ts
  notification-idempotency.ts
apps/api/src/modules/invoices/
  invoice-actions.controller.ts       ← GET صفحة التأكيد / POST القرار
  invoice-action-token.service.ts     ← إنشاء/تحقق برمز مُجزَّأ
apps/api/test/
  jest-e2e.json                       ← مفقود ويشير إليه السكربت
apps/web/app/(dashboard)/invoices/[id]/
  page.tsx                            ← صفحة التفاصيل المفقودة (خ-9)
docs/
  MICA-NOTIFICATIONS-ARCHITECTURE.md
  MICA-OUTLOOK-ACTIONS-SETUP.md
  MICA-EMAIL-DELIVERABILITY.md
  MICA-NOTIFICATIONS-OPERATIONS.md
  MICA-NOTIFICATIONS-SECURITY.md
```

---

## 15. خطة Migration آمنة

**كل الخطوات إضافية. لا حذف عمود، ولا إعادة تسمية، ولا تغيير قيمة enum قائمة.**

### M1 — توسعة `Notification` (آمنة تمامًا)

```prisma
systemKey       String   @default("MICA")
idempotencyKey  String?  @unique
correlationId   String?
attempts        Int      @default(0)
lastError       String?
providerMessageId String?
nextAttemptAt   DateTime?
failedAt        DateTime?
```

كلها اختيارية أو ذات قيمة افتراضية → الصفوف القائمة تُملأ تلقائيًا. `@unique` على عمود قابل للإفراغ يسمح بعدد غير محدود من `NULL` في Postgres، فالصفوف القديمة لا تتعارض.

### M2 — توسعة `NotificationStatus`

```
PENDING SENT FAILED READ            ← القائمة، تبقى كما هي
+ PROCESSING RETRY DEAD SKIPPED     ← إضافة فقط
```

`ALTER TYPE … ADD VALUE` غير قابل للتراجع في Postgres لكنه غير كاسر. **القيم القائمة لا تُعاد تسميتها** — لذا يبقى `ACCEPTED` على الفاتورة كما هو.

### M3 — جدول `InvoiceActionToken`

`tokenHash` (SHA-256، **لا يُخزَّن الرمز الصريح أبدًا**)، `invoiceId`, `userId`, `expiresAt`, `usedAt?`, `createdAt`. جدول جديد بالكامل → صفر خطر.

### M4 — قفل تفاؤلي على الفاتورة

**هذه الخطوة الوحيدة التي تلمس جدولًا قائمًا يحمل بيانات حيّة.**

الخيار المفضّل: **بلا migration إطلاقًا.** يكفي استبدال `update` بـ `updateMany` مشروط:

```ts
const { count } = await prisma.invoice.updateMany({
  where: { id, status: "PENDING", deletedAt: null },
  data: { status: "ACCEPTED", … },
});
if (count === 0) throw new ConflictException(…);
```

يغلق خ-1 بالكامل بذرّية قاعدة البيانات نفسها، بلا عمود `version` وبلا migration. هذا هو المقترح.

### ترتيب التنفيذ

`M1 → M2 → M3` مستقلة وقابلة للتراجع منطقيًا. `M4` تغيير كود بحت.
**قبل أي تطبيق على الإنتاج:** نسخة احتياطية عبر وحدة `backup` القائمة.

---

## 16. نقاط التوسعة بلا تخريب

1. `NotificationsService.notify()` — نقطة دخول واحدة يستخدمها 6 وحدات. أي تحسين فيها يعمّ فورًا.
2. `NotificationChannel` — واجهة قائمة بخمسة محوّلات. إضافة موفّر بريد = محوّل جديد بلا مساس بالمتصلين.
3. `PermissionCacheService.findUserIdsWithPermission()` — نقطة تحديد المستلمين الوحيدة.
4. `AuditLogInterceptor` — يلتقط أي مسار جديد تلقائيًا؛ نقاط الإجراء الجديدة تُدقَّق بلا كود إضافي.
5. `EMAIL_QUEUE` — الطابور موجود بإعادة محاولة أسّية؛ يكفي ضبط الإعدادات.
6. `@Permissions()` — حماية النقاط الجديدة بسطر واحد.
7. `SPECIAL_ACTIONS` في `permissions.ts` — إضافة صلاحية إدارة الإشعارات تغيير سطر واحد + زرع.

---

## 17. خط الأساس المُتحقَّق منه فعليًا

شُغّلت هذه الأوامر فعليًا، وهذه نتائجها الحقيقية:

| الأمر | النتيجة |
|---|---|
| `pnpm typecheck` | ✅ **4/4 نجحت** |
| `pnpm build` | ✅ **3/3 نجحت** |
| `pnpm test` | ❌ **فشل** — `No tests found, exiting with code 1` |
| `pnpm lint` | ❌ **فشل** — 3 تحذيرات مع `--max-warnings 0` |

**`test` و `lint` مكسوران قبل أي تعديل مني.** أي عمل لاحق يجب أن يصلحهما لا أن يُلام عليهما.

---

## 18. معلومات ناقصة — تحتاج قرارًا أو تحققًا خارجيًا

**لا أفترض أيًّا منها. كلها تُوقف مراحل لاحقة حتى تُحسم.**

| # | السؤال | يوقف |
|---|---|---|
| 1 | **هل Redis يعمل فعلًا على خادم الإنتاج؟** لم أتمكن من التحقق (الوصول محجوب). إن لم يكن، فالبريد لا يعمل أصلًا اليوم. | كل شيء |
| 2 | **هل توجد بيانات SMTP حقيقية مضبوطة؟** الافتراضي `localhost:1025` (Mailhog للتطوير). | Phase 3 |
| 3 | **هل تملك الشركة مستأجر Microsoft 365 ونطاقًا مملوكًا؟** | Phase 5 |
| 4 | **هل جميع المستخدمين لديهم بريد حقيقي؟** `User.email` قد يكون بريدًا وهميًا لحسابات السائقين. | Phase 2 |
| 5 | **هل يبقى الإشعار لكل من يملك `invoices:approve`، أم يُضيَّق حسب فرع المركبة؟** التضييق **تغيير سلوك قائم**. | Phase 2 |
| 6 | **`ACCEPTED` أم `APPROVED`؟** لن أعيد تسمية حالة قائمة. المقترح: `MICA_INVOICE_ACCEPTED` تبعًا لمفردات المشروع. | Phase 2 |
| 7 | **هل كلمة مرور SMTP مشفَّرة في جدول `Setting`؟** يلزم فحص `settings.service.ts` قبل الاعتماد عليها. | Phase 1 |
| 8 | **ما النطاق العام لـ MICA؟** لازم لـ `MICA_PUBLIC_URL` وروابط البريد. | Phase 3 |
| 9 | **اختبار الحِمل (100 فاتورة / 500 إشعار) — على أي بيئة؟** تشغيله على الإنتاج يرسل بريدًا حقيقيًا. | Phase 6 |

---

## 19. الخطوة التالية المقترحة

**لا أنتقل إلى Phase 1 قبل جوابك على السؤالين 1 و 5** — الأول لأنه قد يكشف أن العطل الحقيقي في البنية التحتية لا في الكود، والثاني لأنه يغيّر سلوكًا قائمًا ولا يجوز أن أقرّره عنك.

بقية الأسئلة يمكن أن تسير بالتوازي مع Phase 1.

**اقتراح ترتيب معدَّل** يقدّم إصلاح ما هو مكسور اليوم على بناء الجديد:

- **Phase 1أ — إصلاحات حرجة:** خ-1 (السباق) و خ-2 (حقن HTML). كلاهما ثغرة قائمة، وإصلاحهما صغير ومستقل ولا ينتظر أي قرار.
- **Phase 1ب — أساس الإشعارات:** M1–M3 + واجهة الموفّر + بنية الاختبار.
- ثم Phase 2 وما بعدها كما ورد.
