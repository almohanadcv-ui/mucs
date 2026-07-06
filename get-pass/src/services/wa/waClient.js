/*
 * waClient.js — حامل مرجع عميل واتساب (whatsapp-web.js)
 * ----------------------------------------------------
 * يضع وكيل واتساب العميلَ هنا عند الجاهزية، ليستخدمه الإرسال الصادر (outbound).
 * يتجنّب الاقتران المباشر بين الوحدات.
 */
let client = null;
export function setClient(c) { client = c; }
export function getClient() { return client; }
export function isReady() { return !!client; }

// آخر رسالة لكل مستخدم (للردّ عليها/في نفس المحادثة)
const lastMsg = new Map();
export function setLastMsg(userId, chatId, msgId) { if (userId) lastMsg.set(userId, { chatId, msgId }); }
export function getLastMsg(userId) { return (userId && lastMsg.get(userId)) || null; }
