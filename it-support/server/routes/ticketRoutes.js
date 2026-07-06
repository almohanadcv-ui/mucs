import express from 'express';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  addReply,
  deleteTicket,
  getDeletedTickets,
  restoreTicket,
  forceDeleteTicket,
} from '../controllers/ticketController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../utils/permissions.js';

const PRIV = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'];
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('نوع الملف غير مسموح به.'));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter,
});

const handleUpload = (field, maxCount) => (req, res, next) => {
  upload.array(field, maxCount)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `حجم الملف يتجاوز الحد الأقصى (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB).` });
      }
      return res.status(400).json({ message: err.message || 'خطأ في رفع الملف.' });
    }
    if (err) {
      return res.status(400).json({ message: err.message || 'نوع الملف غير مسموح به.' });
    }
    return next();
  });
};

const router = express.Router();
// Build marker: v3-2026-05-31-delete-force-rebuild
console.log('[ticketRoutes] loaded — registering routes...');

// ─────────────────────────────────────────────────────────────────
// Collection routes
// ─────────────────────────────────────────────────────────────────
router.post('/', protect, handleUpload('attachments', 10), createTicket);
router.get('/', protect, getTickets);

// ─────────────────────────────────────────────────────────────────
// Trash routes — MUST come before /:id (Express matches in order)
// ─────────────────────────────────────────────────────────────────
router.get('/deleted', protect, requirePermission('VIEW_TRASH', PRIV), getDeletedTickets);
router.post('/:id/restore', protect, requirePermission('TICKET_DELETE', PRIV), restoreTicket);
router.delete('/:id/force', protect, authorize('ADMIN', 'SUPER_ADMIN'), forceDeleteTicket);

// ─────────────────────────────────────────────────────────────────
// Single ticket routes
// ─────────────────────────────────────────────────────────────────
router.get('/:id', protect, getTicketById);
// updateTicket handles claim/status/billingStatus — allow privileged role
// OR TICKET_CLAIM / INVOICE_APPROVE (controller checks billingStatus path)
router.put('/:id', protect, requireAnyPermission(['TICKET_CLAIM', 'INVOICE_APPROVE'], PRIV), updateTicket);
router.delete('/:id', protect, requirePermission('TICKET_DELETE', PRIV), deleteTicket);
router.post('/:id/delete', protect, requirePermission('TICKET_DELETE', PRIV), deleteTicket);
router.post('/:id/force-delete', protect, authorize('ADMIN', 'SUPER_ADMIN'), forceDeleteTicket);

// ─────────────────────────────────────────────────────────────────
// Reply route
// ─────────────────────────────────────────────────────────────────
router.post('/:id/reply', protect, handleUpload('attachments', 10), addReply);

console.log('[ticketRoutes] registered', router.stack.filter(l => l.route).length, 'routes');
export default router;
