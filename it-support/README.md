# MAB UNITED — Support System

> **Copyright © 2026 IT.MAB. All Rights Reserved.**
> **Owner & Developer:** IT.MAB

نظام دعم فني SaaS متكامل — يدير تذاكر الدعم، الفواتير، إدارة المستخدمين، والإشعارات الفورية. مصمم للاستخدام الداخلي للشركة مع تحكم كامل بالصلاحيات.

---

## ✨ المزايا الرئيسية

| الميزة | الوصف |
|--------|-------|
| 🎫 **نظام تذاكر** | إنشاء، تعيين، رد، إغلاق التذاكر مع مرفقات |
| 💬 **دردشة فورية** | محادثات real-time عبر Socket.IO مع typing indicator |
| 👥 **إدارة مستخدمين** | تفعيل/حذف/تعديل + 4 صلاحيات (EMPLOYEE, IT_SUPPORT, ADMIN, SUPER_ADMIN) |
| 💼 **إدارة فواتير** | تتبع مالي بنظام Excel-like + موافقة/رفض من الإدارة |
| 📧 **إيميل تلقائي** | تفعيل + استعادة كلمة المرور عبر Gmail SMTP |
| 🌗 **Dark Mode** | + تكبير/تصغير الخط للوصولية |
| 📊 **لوحة تحكم** | إحصائيات + توزيع حسب القسم والتصنيف |
| 🔐 **أمان متعدد الطبقات** | JWT, Bcrypt, Rate Limit, Helmet, CORS, HPP |
| 📝 **تسجيل شامل** | لوقز للأحداث الأمنية مع IP geolocation |
| 💾 **نسخ احتياطي** | mysqldump تلقائي + rotation |

---

## 🏗️ التقنيات

### Frontend
- **React 18** + **Vite 5** + **TailwindCSS**
- **Framer Motion** — animations
- **Socket.IO Client** — real-time
- **Axios** — HTTP + interceptors
- **React Hot Toast** — notifications
- **Lucide React** — icons

### Backend
- **Node.js 20+** + **Express 4**
- **Sequelize 6** (MySQL 8)
- **Socket.IO 4** — WebSocket
- **JWT** — auth
- **Bcryptjs** — password hashing
- **Multer** — uploads
- **Nodemailer** — email
- **Helmet** + **HPP** + **express-rate-limit** — security

---

## 📋 متطلبات التشغيل

- **Node.js** ≥ 18.0.0
- **MySQL** ≥ 8.0
- **npm** ≥ 9
- (اختياري) **Docker** & **docker-compose**

---

## 🚀 التشغيل المحلي (Development)

### 1️⃣ قاعدة البيانات
```sql
CREATE DATABASE mab_united_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 2️⃣ السيرفر (Backend)
```bash
cd server
cp .env.example .env       # ثم عدّل القيم
npm install
npm run reset-db           # ينشئ الجداول + IT user افتراضي
npm run dev
```

### 3️⃣ الواجهة (Frontend)
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

افتح: http://localhost:5173

### 4️⃣ الحساب الافتراضي
| البريد | كلمة المرور | الصلاحية |
|--------|-------------|-----------|
| `it@mab.com` | `password123` | IT_SUPPORT |

⚠️ **غيّر كلمة المرور فوراً بعد أول دخول!**

---

## 🐳 التشغيل عبر Docker (Production)

```bash
cp .env.example .env       # ثم عدّل JWT_SECRET + كلمة مرور DB
docker compose up -d --build
```

افتح: http://localhost — كل شيء (DB + API + Client + Nginx) يشتغل تلقائياً.

---

## 📦 الرفع على VPS

اقرأ التفاصيل الكاملة في **[DEPLOY.md](DEPLOY.md)** — يشرح:

1. إعداد VPS Ubuntu (Hostinger / DigitalOcean)
2. تثبيت Node + MySQL + Nginx
3. إعداد PM2 (Cluster mode)
4. شهادة SSL مجانية عبر Let's Encrypt
5. النسخ الاحتياطي التلقائي
6. مراقبة اللوقز

---

## 🔐 الأمان

| الطبقة | الإجراء |
|--------|---------|
| Authentication | JWT 1d expiry + httpOnly recommended |
| Passwords | Bcrypt (12 salt rounds) |
| Rate Limiting | 20 fails/15min على /api/auth |
| Headers | Helmet (HSTS, X-Frame, CSP-ready) |
| CORS | Whitelist للـ FRONTEND_URL فقط |
| XSS | React escape + input validation |
| SQL Injection | Sequelize parameterized queries |
| CSRF | Token-based auth (not cookies) |
| Sockets | JWT-authenticated handshake |
| Logs | IP + UA + geo + tamper-evident |

---

## 📊 السكريبتات المتوفرة

### Server
```bash
npm run dev              # تطوير مع nodemon
npm start                # إنتاج
npm run migrate          # هجرة plainPassword
npm run seed             # إنشاء حسابات تجريبية
npm run reset-db         # إعادة بناء كاملة
npm run backup           # نسخة احتياطية فورية
npm run backup:rotate    # حذف النسخ الأقدم من 14 يوم
npm run test:email <to>  # اختبار إرسال بريد
```

### Client
```bash
npm run dev              # تطوير
npm run build            # بناء للإنتاج
npm run preview          # معاينة الـ build
npm run lint             # فحص الكود
```

---

## 🗂️ هيكل المشروع

```
fin/
├── client/                     # React + Vite frontend
│   ├── public/                 # ملفات ثابتة (logo, robots.txt)
│   ├── src/
│   │   ├── pages/              # Login, Dashboard, Tickets, Archive, Users, FAQ
│   │   ├── context/            # AuthContext, SocketContext
│   │   ├── layouts/            # MainLayout
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf              # nginx لداخل Docker
│   └── vite.config.js
│
├── server/                     # Node + Express backend
│   ├── config/                 # database.js
│   ├── controllers/            # auth, ticket, user, stats
│   ├── middleware/             # auth, error, requestLogger
│   ├── models/                 # Sequelize models
│   ├── routes/                 # 4 route files
│   ├── sockets/                # JWT-authenticated socket.io
│   ├── utils/                  # email, logger, ipLookup, token
│   ├── scripts/                # backup, migrate, test-email
│   ├── Dockerfile
│   ├── ecosystem.config.cjs    # PM2 config
│   └── server.js
│
├── deploy/                     # ملفات النشر
│   └── nginx-vps.conf          # nginx للإنتاج على VPS
│
├── database/
│   └── schema.sql              # توثيق الـ schema
│
├── docker-compose.yml          # تشغيل كامل الستاك
├── .env.example                # قالب البيئة
├── .gitignore
├── LICENSE                     # حقوق IT.MAB
├── DEPLOY.md                   # دليل النشر التفصيلي
└── README.md                   # هذا الملف
```

---

## 🆘 المشاكل الشائعة

| المشكلة | الحل |
|---------|------|
| `ECONNREFUSED 127.0.0.1:3306` | شغّل MySQL: `net start MySQL97` |
| الإيميل لا يصل | تأكد من Gmail App Password في `.env` |
| Rate limit 429 | انتظر 15 دقيقة أو أعد تشغيل السيرفر |
| Socket لا يتصل | تأكد من JWT_SECRET متطابق بين الجلسات |

---

## 📞 الدعم والترخيص

```
Copyright © 2026 IT.MAB. All Rights Reserved.
Owner & Developer: IT.MAB
```

هذا المشروع **ملكية حصرية** لـ IT.MAB. الاستخدام، النسخ، التعديل، أو إعادة التوزيع بدون إذن خطي مسبق **ممنوع** ويعرّض المخالف للمساءلة القانونية.
