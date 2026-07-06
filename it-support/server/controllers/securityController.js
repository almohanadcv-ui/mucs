/**
 * Security Controller — exposes the SecurityLog for admin auditing.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { SecurityLog } from '../models/index.js';

const isAdmin = (role) => ['ADMIN', 'SUPER_ADMIN'].includes(role);

/**
 * GET /api/security/logs
 * Returns the most recent security events for the current company.
 * Query params:
 *   limit  — number of rows (default 50, max 500)
 *   event  — optional filter: login_success | login_failed | etc.
 *   search — optional substring match against email / userName / ip / city
 */
/**
 * GET /api/security/log-files — list available log files
 * GET /api/security/log-files/:name — download one log file
 *
 * Restricted to ADMIN/SUPER_ADMIN. Files live in the server's `logs/`
 * folder (configurable via LOGS_DIR env var).
 */
const LOGS_DIR = process.env.LOGS_DIR || 'logs';
const SAFE_NAME = /^[\w.\-]+\.log$/;

export const listLogFiles = async (req, res) => {
  // Authorization handled by route middleware (requirePermission VIEW_LOGS).
  try {
    if (!fs.existsSync(LOGS_DIR)) return res.json({ files: [] });
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => SAFE_NAME.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(LOGS_DIR, f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return res.json({ files });
  } catch (err) {
    console.error('[listLogFiles]', err);
    return res.status(500).json({ message: 'فشل قراءة المجلد.' });
  }
};

export const downloadLogFile = async (req, res) => {
  // Authorization handled by route middleware (requirePermission VIEW_LOGS).
  const name = req.params.name;
  if (!SAFE_NAME.test(name)) {
    return res.status(400).json({ message: 'اسم ملف غير صالح.' });
  }
  const full = path.join(LOGS_DIR, name);
  if (!fs.existsSync(full)) {
    return res.status(404).json({ message: 'الملف غير موجود.' });
  }
  return res.download(full, name);
};

export const getSecurityLogs = async (req, res) => {
  try {
    // Authorization handled by route middleware (requirePermission VIEW_LOGS).
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const where = {};

    // Scope to current company. Many login_failed events won't have a
    // companyId (user wasn't authenticated yet) — include those too.
    where[Op.or] = [
      { companyId: req.user.companyId },
      { companyId: null },
    ];

    if (req.query.event) {
      where.eventType = req.query.event;
    }

    if (req.query.search) {
      const s = `%${req.query.search}%`;
      const searchClause = [
        { email: { [Op.like]: s } },
        { userName: { [Op.like]: s } },
        { ip: { [Op.like]: s } },
        { city: { [Op.like]: s } },
      ];
      // Combine: existing company scope AND search clause
      where[Op.and] = [{ [Op.or]: searchClause }];
    }

    const logs = await SecurityLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return res.json({ count: logs.length, logs });
  } catch (err) {
    console.error('[getSecurityLogs]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};
