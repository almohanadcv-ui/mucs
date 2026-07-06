/*
 * testMatch.js — مسار Proof Of Concept: POST /api/test-permit-match
 * -----------------------------------------------------------------
 * أداة اختبار فقط لمطابقة ملف تصريح بطلب موجود (قراءة فقط).
 * لا يُنشئ تصريحاً، لا يعتمد طلباً، لا يكتب في قاعدة البيانات.
 * يُعيد استخدام وسيط الرفع الحالي (multer) دون تعديله.
 *
 * ملاحظة: غير محمي بمصادقة لتسهيل اختبار الـ PoC. يُنصح بحمايته
 *         (authenticate + authorize) أو حذفه قبل الإنتاج.
 */
import { Router } from 'express';
import fs from 'node:fs';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { matchPermitFile } from '../services/permitMatcher.js';

const router = Router();

// محمي: مراجِع/دعم فقط (يمنع تسريب البيانات وإرهاق OCR للعموم)
router.post('/', authenticate, authorize('reviewer', 'support'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'أرفق ملفاً واحداً باسم الحقل "file" (PDF/JPG/PNG).');
  try {
    const result = await matchPermitFile(req.file);
    res.json(result);
  } finally {
    // أداة اختبار: لا نحتفظ بأي ملف على القرص
    try { if (fs.existsSync(req.file.path)) fs.rmSync(req.file.path); } catch { /* تجاهل */ }
  }
}));

export default router;
