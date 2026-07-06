/** غلاف لالتقاط أخطاء الدوال غير المتزامنة. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** معالج أخطاء عام موحّد. */
export function errorHandler(err, req, res, next) {
  // خطأ الفهرس الفريد (تصريح فعّال مكرر)
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' && /uq_active_permit/.test(err.message)) {
    return res.status(409).json({ error: 'يوجد تصريح فعّال بالفعل لهذا الرقم.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('❌', err);
  res.status(status).json({ error: err.expose ? err.message : (status >= 500 ? 'حدث خطأ في الخادم.' : err.message) });
}

/** ينشئ خطأ يُعرض نصّه للمستخدم. */
export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}
