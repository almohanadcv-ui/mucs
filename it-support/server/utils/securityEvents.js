import { logSecurity } from './logger.js';
import { getClientIp, lookupIp } from './ipLookup.js';
import { SecurityLog } from '../models/index.js';

const persistEvent = async (row) => {
  try {
    await SecurityLog.create(row);
  } catch (err) {
    // Never let logging break the request
    console.error('[securityEvents] DB persist failed:', err.message);
  }
};

const recordEvent = async (req, eventType, extra = {}) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '-';
  const url = req.originalUrl;
  const method = req.method;

  // 1) File log (immediate, never blocks)
  logSecurity({
    event: eventType,
    ip,
    userAgent,
    method,
    url,
    userId: req.user?.id || null,
    role: req.user?.role || null,
    ...extra,
  });

  // 2) DB persist — base record (without geo)
  const baseRow = {
    companyId: req.user?.companyId || null,
    userId: extra.userId || req.user?.id || null,
    email: extra.email || null,
    userName: extra.userName || req.user?.name || null,
    role: extra.role || req.user?.role || null,
    eventType,
    ip,
    userAgent: userAgent.slice(0, 500),
    reason: extra.reason || null,
  };

  // 3) Async geo enrichment, then persist the full record (avoid double rows)
  try {
    const geo = await lookupIp(ip);
    await persistEvent({
      ...baseRow,
      country: geo?.country || null,
      region: geo?.region || null,
      city: geo?.city || null,
      isp: geo?.isp || null,
    });
    logSecurity({
      event: `${eventType}_geo`,
      ip,
      ...geo,
      userAgent,
      method,
      url,
      userId: req.user?.id || null,
      role: req.user?.role || null,
    });
  } catch {
    // Geo lookup failed — still persist what we have
    await persistEvent(baseRow);
  }
};

export const recordSuccessfulLogin = (req, user) =>
  recordEvent(req, 'login_success', {
    email: user.email,
    userId: user.id,
    userName: user.name,
    role: user.role,
  });

export const recordFailedLogin = (req, reason, email) =>
  recordEvent(req, 'login_failed', { reason, email: email || null });

export const recordPasswordChange = (req, email) =>
  recordEvent(req, 'password_changed', { email });

export const recordForbidden = (req, reason) =>
  recordEvent(req, 'forbidden', { reason });

export const recordRateLimitHit = (req) =>
  recordEvent(req, 'rate_limit_hit');

export const recordSuspicious = (req, detail) =>
  recordEvent(req, 'suspicious', { detail });
