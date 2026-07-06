#!/usr/bin/env node
/**
 * Quick test for email setup.
 *
 * Usage:
 *   node scripts/test-email.js you@example.com
 */
import dotenv from 'dotenv';
dotenv.config();

import { sendActivationEmail } from '../utils/email.js';

const recipient = process.argv[2];
if (!recipient) {
  console.error('❌ مطلوب: عنوان بريد المستقبل');
  console.error('   مثال: node scripts/test-email.js you@example.com');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 اختبار إعدادات إرسال البريد');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('MAIL_FROM:', process.env.MAIL_FROM || '(غير معرّفة)');
console.log('MAIL_PASS:', process.env.MAIL_PASS ? '✓ موجودة (' + process.env.MAIL_PASS.length + ' حرف)' : '(غير معرّفة)');
console.log('المستلم:', recipient);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Give the transporter.verify() in email.js a moment to print its result
setTimeout(async () => {
  console.log('\n📤 جاري الإرسال...\n');
  const result = await sendActivationEmail(recipient, 'مستخدم تجريبي', '123456');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (result.ok) {
    console.log('✅ تم الإرسال بنجاح!');
    console.log('   messageId:', result.messageId);
    console.log('\n💡 إذا لم تجد الإيميل في الـ Inbox:');
    console.log('   → افحص مجلد Spam/Junk');
    console.log('   → افحص فلاتر Gmail');
  } else {
    console.log('❌ فشل الإرسال:');
    console.log('   →', result.reason);
    console.log('\n🔧 خطوات الإصلاح:');
    console.log('   1) افتح: https://myaccount.google.com/security');
    console.log('   2) فعّل "2-Step Verification" (إذا غير مفعّل)');
    console.log('   3) أنشئ App Password: https://myaccount.google.com/apppasswords');
    console.log('   4) انسخ كلمة الـ App Password (16 حرف، عادة بمسافات)');
    console.log('   5) في server/.env ضع MAIL_PASS=القيمة (بدون أو مع مسافات)');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(result.ok ? 0 : 1);
}, 2000);
