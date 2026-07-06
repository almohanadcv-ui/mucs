import express from 'express';
import {
  getUsers,
  activateUser,
  createUser,
  updateUserPassword,
  deleteUser,
  getPermissionsCatalog,
  updateUserPermissions,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission, ASSET_PERMS, USER_PERMS } from '../utils/permissions.js';

const router = express.Router();
const PRIV = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'];

// Permissions endpoints — admin only
router.get('/permissions/catalog', protect, authorize('ADMIN', 'SUPER_ADMIN'), getPermissionsCatalog);
router.put('/:id/permissions', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateUserPermissions);

router.route('/')
  // List visible to anyone with USER_* OR ASSET_* permission (asset page needs users dropdown)
  .get(protect, requireAnyPermission([...USER_PERMS, ...ASSET_PERMS], PRIV), getUsers)
  .post(protect, requirePermission('USER_CREATE', PRIV), createUser);

router.put('/:id/activate', protect, requirePermission('USER_CREATE', PRIV), activateUser);
router.put('/:id/password', protect, requirePermission('USER_RESET_PW', PRIV), updateUserPassword);
router.delete('/:id', protect, requirePermission('USER_DELETE', PRIV), deleteUser);

export default router;
