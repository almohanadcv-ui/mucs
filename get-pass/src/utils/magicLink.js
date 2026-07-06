/*
 * magicLink.js — بناء رابط دخول مباشر للمستخدم (يُرسل عبر واتساب).
 * الرابط يحمل توكناً موقّعاً؛ عند الضغط عليه ينشئ الخادم جلسة ويدخل المستخدم مباشرة.
 */
import { config } from '../config.js';
import { signMagic } from './jwt.js';

/** @returns {string|null} رابط الدخول المباشر، أو null إن لم يُضبط BASE_URL. */
export function magicLink(userId) {
  if (!config.publicBaseUrl || !userId) return null;
  return `${config.publicBaseUrl}/api/auth/magic/${signMagic(userId)}`;
}
