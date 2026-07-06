/*
 * outbound.js — الإرسال الصادر عبر واتساب (نص/ملف)
 * ------------------------------------------------
 * يستخدم عميل واتساب الحيّ (waClient). يرمي خطأً إن لم يكن العميل متصلاً
 * (الطابور يعيد المحاولة لاحقاً).
 */
import { getClient } from './waClient.js';

function toChatId(waId) {
  const s = String(waId || '');
  if (s.includes('@')) return s;
  const d = s.replace(/\D/g, '');
  // أرقام طويلة جداً = LID (>13)؛ أرقام الجوال تُرسَل عبر c.us
  return d.length > 13 ? `${d}@lid` : `${d}@c.us`;
}

export async function sendText(waId, text, opts = {}) {
  const c = getClient();
  if (!c) throw new Error('عميل واتساب غير متصل بعد.');
  const chat = opts.chatId || toChatId(waId);
  await c.sendMessage(chat, String(text), opts.quotedMessageId ? { quotedMessageId: opts.quotedMessageId } : {});
}

export async function sendFile(waId, filePath, caption = '') {
  const c = getClient();
  if (!c) throw new Error('عميل واتساب غير متصل بعد.');
  const ww = await import('whatsapp-web.js');
  const MessageMedia = (ww.default || ww).MessageMedia;
  const media = MessageMedia.fromFilePath(filePath);
  await c.sendMessage(toChatId(waId), media, caption ? { caption } : {});
}
