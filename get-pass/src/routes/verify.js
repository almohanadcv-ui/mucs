import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

// التحقق العام من تصريح عبر رمز التحقق (بدون تسجيل دخول) — يكشف الحد الأدنى من البيانات
router.get('/:token', (req, res) => {
  const permit = db.prepare(`
    SELECT permit_number, holder_name, national_id, status, valid_from, valid_to
    FROM permits WHERE verify_token=?
  `).get(req.params.token);

  if (!permit) return res.status(404).json({ valid: false, error: 'لا يوجد تصريح بهذا الرمز.' });

  // إخفاء جزء من رقم الهوية للخصوصية
  const masked = permit.national_id.replace(/.(?=.{4})/g, '*');
  const isActive = permit.status === 'active' && permit.valid_to >= new Date().toISOString().slice(0, 10);

  res.json({
    valid: isActive,
    permit: {
      permit_number: permit.permit_number,
      holder_name: permit.holder_name,
      national_id_masked: masked,
      status: permit.status,
      valid_from: permit.valid_from,
      valid_to: permit.valid_to,
    },
  });
});

export default router;
