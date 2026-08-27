import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { signToken } from '../utils/jwt.js';

/**
 * SSO handoff from the MAB portal. The portal signs a short-lived token with the
 * shared PORTAL_SSO_SECRET (iss=mab-portal, aud=gatepass); here we verify it and
 * open THIS app's own session for the matching email — exactly like the existing
 * magic-link flow, but driven by the portal. Purely additive: it does nothing
 * unless PORTAL_SSO_SECRET is set, so the standalone app is unchanged.
 */
const router = Router();

const findByEmail = db.prepare(
  `SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=?`,
);

router.get('/', (req, res) => {
  const token = req.query.token;
  const secret = process.env.PORTAL_SSO_SECRET;
  if (!token || !secret) return res.redirect('/');

  let email = '';
  try {
    const payload = jwt.verify(String(token), secret, { issuer: 'mab-portal', audience: 'gatepass' });
    email = String(payload.email || '').trim().toLowerCase();
  } catch {
    return res.redirect('/?sso=invalid');
  }
  if (!email) return res.redirect('/');

  const user = findByEmail.get(email);
  if (!user || !user.is_active) return res.redirect('/?sso=nouser');

  // Open a session (single active session, same as a normal login).
  const sid = randomUUID();
  db.prepare(
    `UPDATE users SET session_id=?, last_login_at=datetime('now'), last_activity_at=datetime('now') WHERE id=?`,
  ).run(sid, user.id);
  const authToken = signToken({ id: user.id, role: user.role, sid });
  res.cookie('token', authToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!req.secure,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.redirect('/');
});

export default router;
