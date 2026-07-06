import { verifyToken } from '../utils/jwt.js';
import { db } from '../db/index.js';

const findUser = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.national_id, u.is_active, u.session_id, r.code AS role
  FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
`);

/**
 * يستخرج التوكن من الكوكي أو ترويسة Authorization ويضع المستخدم في req.user.
 */
export function authenticate(req, res, next) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول.' });

  try {
    const decoded = verifyToken(token);
    const user = findUser.get(decoded.id);
    if (!user || !user.is_active) return res.status(401).json({ error: 'الحساب غير صالح أو معطّل.' });
    // جلسة واحدة + إبطال فعلي عند الخروج: يجب أن يطابق sid التوكنُ الجلسةَ المخزّنة دائماً
    // (بعد الخروج تصبح session_id فارغة، فيُرفض التوكن القديم)
    if (decoded.sid !== user.session_id) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'انتهت الجلسة. سجّل الدخول من جديد.' });
    }
    delete user.session_id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية.' });
  }
}
