# 🖥️ النشر على VPS (سيرفر) — Hostinger / DigitalOcean / أي Ubuntu

## المتطلبات
- VPS بنظام **Ubuntu 24.04** (1 vCPU، 2GB RAM، 20GB).
- (اختياري) دومين يشير إلى عنوان IP السيرفر (سجل A).

## النشر بأمر واحد

1. ادخل السيرفر عبر SSH:
   ```bash
   ssh root@SERVER_IP
   ```
2. حمّل السكربت وشغّله:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/almohanadcv-ui/pams/main/deploy/setup.sh -o setup.sh
   # مع دومين + بريد (HTTPS تلقائي):
   bash setup.sh yourdomain.com admin@yourcompany.com
   # أو بدون دومين (IP فقط):
   bash setup.sh
   ```

السكربت يقوم بكل شيء:
- تثبيت Node.js 20 + Nginx + PM2.
- جلب الكود من GitHub وتثبيت الحزم.
- إنشاء `.env` بمفتاح **JWT سري عشوائي** + كلمة مرور مدير عشوائية (تُطبع مرة واحدة).
- تشغيل التطبيق دائماً عبر **PM2** (يعيد التشغيل تلقائياً وبعد إعادة إقلاع السيرفر).
- إعداد **Nginx** كوسيط عكسي + **شهادة HTTPS** من Let's Encrypt (عند وجود دومين).
- التخزين الدائم في `/var/pams-data` (قاعدة البيانات + المرفقات).

## بعد النشر
- افتح `https://yourdomain.com` (أو `http://SERVER_IP`).
- ادخل بحساب المدير المطبوع → **غيّر كلمة المرور** → أنشئ حسابات الموظفين.

## أوامر التشغيل المفيدة
```bash
pm2 logs pams        # السجلّات
pm2 restart pams     # إعادة تشغيل
pm2 status           # الحالة
```

## التحديث لاحقاً (بعد أي تعديل ورفعه على GitHub)
```bash
cd /opt/pams && git pull && npm install --omit=dev && pm2 restart pams
```

## النسخ الاحتياطي
انسخ مجلد `/var/pams-data` دورياً (يحتوي قاعدة البيانات وكل المرفقات):
```bash
tar czf pams-backup-$(date +%F).tar.gz /var/pams-data
```
