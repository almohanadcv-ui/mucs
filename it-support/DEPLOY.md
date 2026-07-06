# 🚀 دليل النشر على Hostinger VPS — MAB UNITED

> Copyright © 2026 IT.MAB. All Rights Reserved.

دليل خطوة بخطوة لرفع النظام على VPS عند Hostinger (أو أي VPS Ubuntu 22.04+).

---

## 📋 المتطلبات

- VPS عند Hostinger مع Ubuntu 22.04 LTS
- دومين موجّه إلى VPS (لاحقاً)
- SSH access

---

## الخطوة 1️⃣ — تجهيز VPS

اتصل بـ VPS:
```bash
ssh root@your-vps-ip
```

حدّث النظام:
```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

أنشئ مستخدم غير-root:
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

---

## الخطوة 2️⃣ — تثبيت Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # تأكد >= 20
npm -v
```

---

## الخطوة 3️⃣ — تثبيت MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo mysql_secure_installation
```

أنشئ قاعدة البيانات:
```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE mab_united_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mabuser'@'localhost' IDENTIFIED BY 'StrongP@ssw0rd!2026';
GRANT ALL PRIVILEGES ON mab_united_db.* TO 'mabuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## الخطوة 4️⃣ — تثبيت Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

---

## الخطوة 5️⃣ — تثبيت PM2 (مدير العمليات)

```bash
sudo npm install -g pm2
```

---

## الخطوة 6️⃣ — سحب المشروع

```bash
sudo mkdir -p /var/www/mab-united
sudo chown deploy:deploy /var/www/mab-united
cd /var/www/mab-united
git clone https://github.com/your-username/your-repo.git .
```

أو إذا كان لديك السورس على الجهاز:
```bash
# من جهازك:
scp -r ./fin/* deploy@your-vps-ip:/var/www/mab-united/
```

---

## الخطوة 7️⃣ — إعداد السيرفر (Backend)

```bash
cd /var/www/mab-united/server
cp .env.example .env
nano .env   # عدّل القيم:
```

محتوى `.env` المطلوب:
```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

DB_HOST=127.0.0.1
DB_USER=mabuser
DB_PASSWORD=StrongP@ssw0rd!2026
DB_NAME=mab_united_db
DB_DIALECT=mysql

JWT_SECRET=<توليد عبر: openssl rand -hex 64>
JWT_EXPIRES_IN=1d

MAX_FILE_SIZE=5242880
BCRYPT_SALT_ROUNDS=12

MAIL_FROM=your-email@gmail.com
MAIL_PASS=your-16-char-app-pass
MAIL_FROM_NAME=MAP UNITED IT
```

ثبّت الحزم + شغّل التهيئة الأولية:
```bash
npm ci --omit=dev
npm run reset-db        # ينشئ الجداول + IT user
```

---

## الخطوة 8️⃣ — بناء الواجهة (Frontend)

```bash
cd /var/www/mab-united/client
cp .env.example .env
nano .env
```

محتوى `.env`:
```env
VITE_API_URL=https://yourdomain.com
```

```bash
npm ci
npm run build           # ينشئ مجلد dist/
```

---

## الخطوة 9️⃣ — إعداد Nginx

```bash
sudo cp /var/www/mab-united/deploy/nginx-vps.conf \
       /etc/nginx/sites-available/mab-united

# عدّل yourdomain.com بدومينك:
sudo sed -i 's/yourdomain.com/yourrealdomain.com/g' \
       /etc/nginx/sites-available/mab-united

sudo ln -s /etc/nginx/sites-available/mab-united /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t          # اختبار الـ config
sudo systemctl reload nginx
```

---

## الخطوة 🔟 — شهادة SSL مجانية (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

اتبع الخطوات (أدخل إيميلك، وافق على ToS). Certbot يعدّل nginx تلقائياً.

تأكد من التجديد التلقائي:
```bash
sudo systemctl status certbot.timer
```

---

## الخطوة 1️⃣1️⃣ — تشغيل السيرفر عبر PM2

```bash
cd /var/www/mab-united/server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup           # اتبع الأمر اللي يطلعه
```

تأكد إنه شغّال:
```bash
pm2 status
pm2 logs mab-api
```

---

## الخطوة 1️⃣2️⃣ — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## ✅ التحقق النهائي

افتح المتصفح:
- https://yourdomain.com  → يفتح صفحة Portal
- https://yourdomain.com/api/health → يرد JSON

سجّل دخول كـ IT (`it@mab.com` / `password123`) — **غيّر كلمة المرور فوراً**.

---

## 🔄 تحديث المشروع لاحقاً

```bash
cd /var/www/mab-united
git pull origin main

# Backend:
cd server && npm ci --omit=dev
pm2 reload mab-api

# Frontend:
cd ../client && npm ci && npm run build
sudo systemctl reload nginx
```

---

## 📊 المراقبة

### اللوقز
```bash
pm2 logs mab-api                    # API logs (live)
pm2 logs mab-api --lines 200        # آخر 200 سطر
tail -f /var/www/mab-united/server/logs/access.log
tail -f /var/www/mab-united/server/logs/security.log
sudo tail -f /var/log/nginx/error.log
```

### الإحصائيات
```bash
pm2 monit              # CPU + RAM لكل عملية
htop
df -h                  # مساحة القرص
```

---

## 💾 النسخ الاحتياطي

### يدوي
```bash
cd /var/www/mab-united/server
npm run backup
```

### تلقائي (يومياً 3 صباحاً)
PM2 cron يشتغل تلقائياً (موجود في ecosystem.config.cjs).

تأكد:
```bash
pm2 list | grep backup
```

### استرجاع نسخة
```bash
cd /var/www/mab-united/server/backups
gunzip db-2026-05-30T03-00-00.sql.gz
mysql -u mabuser -p mab_united_db < db-2026-05-30T03-00-00.sql
```

---

## 🚨 خطة الطوارئ

| المشكلة | الحل |
|---------|------|
| السيرفر ينقطع | `pm2 restart mab-api` |
| Nginx 502 | `sudo systemctl restart nginx` ثم `pm2 logs` |
| MySQL مقفول | `sudo systemctl restart mysql` |
| القرص ممتلئ | `npm run backup:rotate` + احذف logs قديمة |
| SSL منتهي | `sudo certbot renew` |
| الإيميل لا يصل | `npm run test:email` |

---

## 🎯 توصيات VPS

| الخطة | الموارد | المستخدمون المتزامنون |
|------|---------|----------------------|
| KVM 1 | 1 vCPU, 4GB RAM, 50GB | حتى 100 |
| KVM 2 | 2 vCPU, 8GB RAM, 100GB | حتى 500 |
| KVM 4 | 4 vCPU, 16GB RAM, 200GB | حتى 2000 |

---

## 🛡️ خطوات أمنية إضافية (بعد النشر)

1. **عطّل root SSH**:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # غيّر: PermitRootLogin no
   sudo systemctl restart sshd
   ```

2. **ثبّت fail2ban**:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   ```

3. **عطّل SETUP_KEY** بعد إنشاء أول شركة:
   ```bash
   nano /var/www/mab-united/server/.env
   # احذف السطر: SETUP_KEY=...
   pm2 restart mab-api
   ```

---

```
Copyright © 2026 IT.MAB. All Rights Reserved.
```
