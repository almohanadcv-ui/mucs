/**
 * activityTracker — one-call helper used inside controllers to record
 * any business action (create asset, delete user, approve invoice, etc).
 *
 * Persists to BOTH:
 *   1) File: logs/activity.log + logs/activity-YYYY-MM-DD.log
 *   2) DB:   SecurityLog (so admins can view in the Activity page)
 *
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { logActivity } from './logger.js';
import { SecurityLog } from '../models/index.js';
import { getClientIp } from './ipLookup.js';

const persistDb = (row) => {
  // Fire-and-forget — never block the response
  setImmediate(() => {
    SecurityLog.create(row).catch((err) => {
      console.error('[activityTracker] DB persist failed:', err.message);
    });
  });
};

/**
 * Record an activity.
 * @param {object} req — Express request (must be after `protect` middleware)
 * @param {string} action — short verb, e.g. 'asset.create', 'user.delete'
 * @param {object} extra — { targetId, targetName, details }
 */
export const recordActivity = (req, action, extra = {}) => {
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] || '-').slice(0, 500);

  const payload = {
    action,
    userId: req.user?.id || null,
    userName: req.user?.name || null,
    email: req.user?.email || null,
    role: req.user?.role || null,
    companyId: req.user?.companyId || null,
    ip,
    method: req.method,
    url: req.originalUrl,
    targetId: extra.targetId || null,
    targetName: extra.targetName || null,
    details: extra.details || null,
  };

  // 1) File log (always)
  logActivity(payload);

  // 2) DB log so it shows up in the in-app Activity Log page
  persistDb({
    companyId: payload.companyId,
    userId: payload.userId,
    email: payload.email,
    userName: payload.userName,
    role: payload.role,
    eventType: action,
    ip,
    userAgent: ua,
    reason: extra.targetName
      ? `${extra.targetName}${extra.details ? ` — ${extra.details}` : ''}`
      : (extra.details || null),
  });
};
