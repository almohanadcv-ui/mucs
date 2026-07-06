/**
 * Asset Routes
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import express from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAssets,
  getMyAssets,
  getAssetsByUser,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  addMaintenance,
  getAssetStats,
} from '../controllers/assetController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission, ASSET_PERMS } from '../utils/permissions.js';

// Anyone with ANY asset permission (or privileged role) can READ assets pages
const PRIV = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'];
const canReadAssets = requireAnyPermission(ASSET_PERMS, PRIV);
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const router = express.Router();
console.log('[assetRoutes] loaded — registering routes...');

// ───── Invoice file upload (PDF/image) ─────
const invoiceDir = 'uploads/invoices';
if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, invoiceDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(12).toString('hex');
    cb(null, `inv-${Date.now()}-${random}${ext}`);
  },
});

const INVOICE_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
]);

const invoiceUpload = multer({
  storage: invoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!INVOICE_TYPES.has(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم — استخدم PDF أو صورة فقط.'));
    }
    cb(null, true);
  },
});

router.post(
  '/upload-invoice',
  protect,
  authorize('IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'),
  (req, res) => {
    invoiceUpload.single('invoice')(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: 'لم يتم رفع أي ملف.' });
      const url = '/' + req.file.path.replace(/\\/g, '/');
      return res.json({ url, filename: req.file.originalname });
    });
  }
);

// ───── Categories ─────
router.get('/categories', protect, getCategories);
router.post('/categories', protect, requirePermission('ASSET_EDIT', PRIV), createCategory);
router.put('/categories/:id', protect, requirePermission('ASSET_EDIT', PRIV), updateCategory);
router.delete('/categories/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteCategory);

// ───── Stats / Reports ─────
router.get('/stats', protect, canReadAssets, getAssetStats);

// ───── My assets (employee self-service) ─────
router.get('/mine', protect, getMyAssets);

// ───── Assets owned by a specific user (IT/Admin view) ─────
router.get('/by-user/:userId', protect, canReadAssets, getAssetsByUser);

// ───── Assets CRUD ─────
// Read open to any asset-permission holder; mutations require specific perm.
router.get('/', protect, canReadAssets, getAssets);
router.post('/', protect, requirePermission('ASSET_CREATE', ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN']), createAsset);
router.get('/:id', protect, getAssetById);
router.put('/:id', protect, requirePermission('ASSET_EDIT', ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN']), updateAsset);
router.delete('/:id', protect, requirePermission('ASSET_DELETE', ['ADMIN', 'SUPER_ADMIN']), deleteAsset);
router.post('/:id/delete', protect, requirePermission('ASSET_DELETE', ['ADMIN', 'SUPER_ADMIN']), deleteAsset);

// ───── Assignment actions ─────
router.post('/:id/assign', protect, requirePermission('ASSET_ASSIGN', ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN']), assignAsset);
router.post('/:id/return', protect, requirePermission('ASSET_ASSIGN', ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN']), returnAsset);

// ───── Maintenance ─────
router.post('/:id/maintenance', protect, authorize('IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'), addMaintenance);

console.log('[assetRoutes] registered', router.stack.filter(l => l.route).length, 'routes');
export default router;
