import jwt from 'jsonwebtoken';
import { User, Company } from '../models/index.js';
import { recordForbidden } from '../utils/securityEvents.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password', 'plainPassword', 'temporaryCode'] },
      include: [{ model: Company, attributes: ['id', 'name', 'subdomain'] }],
    });

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is not active. Please contact IT Support.' });
    }

    // Single-device enforcement:
    // The presented JWT must EXACTLY match the user's currentSessionToken.
    // Otherwise the session was either:
    //   - explicitly logged out (currentSessionToken=null), or
    //   - replaced by another login (currentSessionToken!=token).
    // In both cases, the request is treated as stale and rejected.
    if (user.currentSessionToken !== token) {
      return res.status(401).json({
        message: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
        code: 'SESSION_INVALID',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.' });
    }
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // Log every authorization failure — this is the key signal that a user
      // is trying to access something they shouldn't. Surfaces in the
      // SecurityLog admin page so any tampering attempt is visible.
      const reason = `attempted ${req.method} ${req.originalUrl} (needs ${roles.join('|')}, has ${req.user?.role || 'none'})`;
      // Fire-and-forget — never block the response
      setImmediate(() => {
        try { recordForbidden(req, reason); } catch {}
      });

      // Don't leak the required roles in the response — generic message
      return res.status(403).json({
        message: 'لا تملك صلاحية الوصول إلى هذه الخدمة.',
      });
    }
    return next();
  };
};
