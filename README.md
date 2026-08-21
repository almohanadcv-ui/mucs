# MAB United — منصّة الأنظمة (Monorepo)

مستودع موحّد يضم كل أنظمة **MAB United** وبوّابتها الموحّدة. كل نظام مستقل في مجلده،
وله قاعدته وعمليته الخاصة على الخادم، وتجمعها **بوّابة MAB** في مكان واحد.

> **مبدأ حاكم:** الأنظمة معزولة عن بعضها. البوّابة تعرضها وتوحّد الدخول إليها، ولا
> تستبدلها. أي تكامل يُضاف بأصغر تغيير ممكن (مسار `/sso`) ويُجرَّب على نسخة أولًا.

## الخريطة
| المجلد | النظام | التقنية | القاعدة | pm2 | المنفذ |
|---|---|---|---|---|---|
| `mab-portal/` | **البوّابة الموحّدة** (Jisr-like) | Next.js 15 · Prisma | PostgreSQL `mab_portal` | `mab-portal` | 3005 |
| `evaluation/` | تقييم الموظفين | Next.js · Prisma | PostgreSQL | `evaluation` | 3000 |
| `get-pass/` | التصاريح والموافقات | Express · SQLite | SQLite (ملف) | `get-pass` | 4000 |
| `mica/` | إدارة المركبات (أسطول) | NestJS + Next.js | PostgreSQL | `mica-api` · `mica-web` | 3002 (web) |
| `MabTaskAllocator/` | توزيع المهام | React (Vite) + API | — | `tasks-api` | — |
| `it-support/` | الدعم الفني (التذاكر) | React (Vite) + خادم | قاعدة النظام | *(قيد الدمج)* | — |
| `mcs-landing/` | صفحة الهبوط التعريفية | — | — | `mucs` | — |
| `scripts/` | سكربتات النشر المشتركة | — | — | — | — |

> المنافذ الدقيقة في `.env`/`ecosystem` لكل تطبيق. راجع `pm2 list` على الخادم.

## البوّابة الموحّدة
`mab-portal/` هي الواجهة الجامعة (دخول واحد بالبريد + كود، أنظمة على اليمين، صفحة
رئيسية بالإعلانات والمناسبات، الموظفون والمخطط التنظيمي والعُهد، لوحة IT، مساعد ذكي).
**التوثيق الكامل:** `mab-portal/ARCHITECTURE.md` و`mab-portal/README.md`.

- منشورة على `portal.mucs.online` (pm2 `mab-portal`، nginx `mab-portal/deploy/nginx-portal.conf`).
- تعرض الأنظمة داخلها عبر iframe على نفس الأصل (`/apps/<key>`)، وتسلّمها الهوية عبر
  مسار `/sso` صغير يُضاف لكل نظام لاحقًا (على نسخة قبل الأصل).

## النشر (الخادم)
كل الأنظمة تحت `/var/www/mucs` وتُدار بـ**pm2** خلف **nginx**.
```bash
cd /var/www/mucs && git pull            # يسحب كل الأنظمة
# ثم لكل نظام غيّرته: install → (prisma generate/migrate) → build → pm2 restart <name>
```
- سكربت النشر المشترك: `scripts/deploy.sh`.
- البوّابة: راجع `mab-portal/README.md` (قاعدة + env + nginx + نسخ احتياطي).

## النسخ الاحتياطي
- **البوّابة:** `mab-portal/scripts/backup.sh` (pg_dump يومي + تدوير) عبر cron.
- بقية أنظمة PostgreSQL: نفس النمط (pg_dump للقاعدة). get-pass: انسخ ملف SQLite.

## تنظيم العمل
- **فرع رئيسي واحد** (`main`)؛ كل تعديل يُرفع ويُنشر لنظامه فقط.
- **لا تنقل مجلدات الأنظمة** — الخادم (pm2/nginx/مسارات) يعتمد عليها.
- ملفات مؤقتة/أرشيفات (مثل `*.rar` / `*.zip`) لا تُرفع؛ احذفها محليًا عند الانتهاء.

## للمهندس القادم
ابدأ من هذا الملف ← ثم `mab-portal/ARCHITECTURE.md` لفهم البوّابة ← ثم `README` كل
نظام. القاعدة والملفات موثّقة، والهجرات متتبَّعة (Prisma migrations) لكل نظام Postgres.
