import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// توكن دخول مباشر (يُرسل عبر واتساب) — منفصل عن توكن الجلسة، صلاحية أطول، غرض محدّد
export function signMagic(userId) {
  return jwt.sign({ id: userId, purpose: 'magic' }, config.jwtSecret, { expiresIn: `${config.magicLinkDays}d` });
}

export function verifyMagic(token) {
  const d = jwt.verify(token, config.jwtSecret);
  if (d.purpose !== 'magic') throw new Error('ليس توكن دخول مباشر');
  return d;
}

// توكن مؤقّت لخطوة التحقّق الثنائي (OTP) — قصير الأجل، لا يمنح جلسة
export function signPending(userId) {
  return jwt.sign({ id: userId, purpose: 'otp' }, config.jwtSecret, { expiresIn: '10m' });
}
export function verifyPending(token) {
  const d = jwt.verify(token, config.jwtSecret);
  if (d.purpose !== 'otp') throw new Error('توكن غير صالح');
  return d;
}
