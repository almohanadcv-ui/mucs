/**
 * Security Routes — admin-only audit log access.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import express from 'express';
import { getSecurityLogs, listLogFiles, downloadLogFile } from '../controllers/securityController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../utils/permissions.js';

const router = express.Router();
console.log('[securityRoutes] loaded — registering routes...');

const ADMIN_FALLBACK = ['ADMIN', 'SUPER_ADMIN'];
router.get('/logs', protect, requirePermission('VIEW_LOGS', ADMIN_FALLBACK), getSecurityLogs);
router.get('/log-files', protect, requirePermission('VIEW_LOGS', ADMIN_FALLBACK), listLogFiles);
router.get('/log-files/:name', protect, requirePermission('VIEW_LOGS', ADMIN_FALLBACK), downloadLogFile);

console.log('[securityRoutes] registered', router.stack.filter(l => l.route).length, 'routes');
export default router;
