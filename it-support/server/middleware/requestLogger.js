import { logAccess } from '../utils/logger.js';
import { getClientIp } from '../utils/ipLookup.js';

// Routes whose bodies must NEVER be logged
const SENSITIVE_ROUTES = [
  '/api/auth/login',
  '/api/auth/change-password',
  '/api/auth/forgot-password',
  '/api/auth/register',
  '/api/users',
];

const isSensitive = (url) => SENSITIVE_ROUTES.some(p => url.startsWith(p));

export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '-';

  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    const userId = req.user?.id || null;
    const role = req.user?.role || null;

    logAccess({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip,
      userAgent,
      userId,
      role,
      companyId: req.user?.companyId || null,
      referer: req.headers.referer || null,
      bodySize: isSensitive(req.originalUrl) ? null : (req.headers['content-length'] || null),
    });
  });

  next();
};
