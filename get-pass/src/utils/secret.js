// تشفير/فك تشفير كلمات المرور بشكل قابل للاسترجاع (AES-256-GCM)
// للسماح لفريق الدعم بعرض كلمة المرور الحالية. المفتاح مشتقّ من JWT_SECRET.
import crypto from 'node:crypto';
import { config } from '../config.js';

const KEY = crypto.createHash('sha256').update(String(config.jwtSecret) + '::pw').digest();

export function encryptPw(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptPw(b64) {
  try {
    const b = Buffer.from(b64, 'base64');
    const iv = b.subarray(0, 12), tag = b.subarray(12, 28), enc = b.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
