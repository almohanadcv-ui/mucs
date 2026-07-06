-- قاعدة البيانات سيتم إنشاؤها تلقائيا من قبل ORM (Sequelize)
-- ولكن هذا الملف للتوثيق بناء على الطلب

CREATE DATABASE IF NOT EXISTS mab_united_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mab_united_db;

-- ملاحظة:
-- النظام يستخدم Sequelize في Node.js، وهو يقوم بإنشاء هذه الجداول أوتوماتيكياً
-- عند أول تشغيل عبر الأمر: sequelize.sync({ alter: true })
-- في ملف server.js

-- الجداول التي سيتم إنشاؤها:
-- 1. Companies
-- 2. Users (مع ربطه بـ Company)
-- 3. Tickets
-- 4. Replies
-- 5. Attachments
-- 6. Notifications
