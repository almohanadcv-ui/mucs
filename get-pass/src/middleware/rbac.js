import { hasPermission } from '../services/permissions.js';

/**
 * يسمح بالمرور للأدوار أو الصلاحيات المحددة.
 * @param  {...string} grants
 */
export function authorize(...grants) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'يلزم تسجيل الدخول.' });
    if (grants.includes(req.user.role) || grants.some((g) => hasPermission(req.user, g)))
      return next();
    if (!grants.includes(req.user.role))
      return res.status(403).json({ error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' });
  };
}
