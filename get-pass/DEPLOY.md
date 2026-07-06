# 🚀 دليل النشر — PAMS

النظام: Node.js + Express + SQLite (مع تخزين ملفات محلي). الأنسب للنشر: **Railway** (يدعم خادماً دائماً + قرص دائم Volume).
> Vercel وحده لا يصلح لهذا النظام (لا يحفظ ملفات ولا قاعدة بيانات دائمة). استخدم Railway.

---

## الخطوة 1) رفع الكود على GitHub

### أ) أنشئ مستودعاً على GitHub
1. ادخل https://github.com/new
2. اسم المستودع مثلاً: `pams` — اجعله **Private** — لا تضف README/‏gitignore (موجودة).
3. اضغط Create repository، وانسخ رابط المستودع (مثل: `https://github.com/USERNAME/pams.git`).

### ب) ارفع الكود (شغّل في مجلد المشروع)
```bash
git add .
git commit -m "PAMS initial release"
git branch -M main
git remote add origin https://github.com/USERNAME/pams.git
git push -u origin main
```
> سيطلب منك تسجيل الدخول إلى GitHub (استخدم Personal Access Token ككلمة مرور إن طُلب).

---

## الخطوة 2) النشر على Railway

1. ادخل https://railway.app وسجّل بحساب GitHub.
2. **New Project → Deploy from GitHub repo** → اختر مستودع `pams`.
3. Railway سيكتشف Node تلقائياً ويشغّل `npm start`.

### أ) أضف قرصاً دائماً (Volume) — مهم لحفظ البيانات والملفات
- من المشروع: **+ New → Volume**.
- Mount path: `/data`
- اربطه بالخدمة (Service).

### ب) اضبط متغيّرات البيئة (Variables)
أضف:
```
NODE_ENV=production
JWT_SECRET=<ضع مفتاحاً عشوائياً طويلاً>
DATA_DIR=/data
RENEWAL_WINDOW_DAYS=5
DEFAULT_PERMIT_DAYS=365
NATIONAL_ID_MODE=saudi
```
> توليد JWT_SECRET قوي:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> (اختياري) لضبط حساب الدعم الأول:
> `SEED_SUPPORT_EMAIL=admin@yourcompany.com` و `SEED_SUPPORT_PASSWORD=...`

3. Railway يعطيك **رابط HTTPS عاماً** (Domain) — افتحه، وستجد الحسابات الافتراضية مزروعة تلقائياً.

---

## الحماية المُفعّلة (إنتاجياً)
- 🔒 **HTTPS** تلقائي من Railway.
- 🔑 **JWT** موقّع بمفتاح سري من البيئة + **كوكي HttpOnly + Secure** في الإنتاج.
- 🧱 **Helmet + CSP** (سياسة محتوى تسمح فقط بالمصادر الموثوقة).
- 🚦 **Rate limiting** على الدخول وكل الـ API.
- 🔐 كلمات المرور **مجزّأة bcrypt** (+ نسخة مشفّرة AES لعرضها للدعم).
- 🧾 **سجل تدقيق** بسلسلة تجزئة غير قابلة للعبث.
- 👤 **جلسة واحدة** لكل مستخدم + تسجيل خروج عند إغلاق الصفحة.
- 📤 فحص المرفقات (النوع/الحجم) + تخزين بـ checksum.

## بعد النشر (مهم)
1. سجّل دخول بحساب الدعم → **غيّر كل كلمات المرور الافتراضية**.
2. أنشئ حسابات الموظفين الحقيقية من «المستخدمون».
3. (موصى) فعّل سياسة نسخ احتياطي للـ Volume من Railway.
