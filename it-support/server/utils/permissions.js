/**
 * Permissions catalog + checker.
 *
 * Permissions are extra capabilities granted to specific users on top of
 * their role. Example: an EMPLOYEE granted `ASSET_CREATE` can add custodies,
 * even though that's normally restricted to IT_SUPPORT and above.
 *
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */

// Master catalog — keep in sync with frontend permissions UI.
export const PERMISSIONS = {
  // Assets / Custodies
  ASSET_CREATE:   { key: 'ASSET_CREATE',   label: 'إضافة عهدة',           group: 'العهد' },
  ASSET_EDIT:     { key: 'ASSET_EDIT',     label: 'تعديل عهدة',           group: 'العهد' },
  ASSET_DELETE:   { key: 'ASSET_DELETE',   label: 'حذف عهدة',             group: 'العهد' },
  ASSET_ASSIGN:   { key: 'ASSET_ASSIGN',   label: 'تسليم/استرجاع عهدة',   group: 'العهد' },

  // Users
  USER_CREATE:    { key: 'USER_CREATE',    label: 'إنشاء حساب موظف',      group: 'المستخدمين' },
  USER_DELETE:    { key: 'USER_DELETE',    label: 'حذف حساب موظف',        group: 'المستخدمين' },
  USER_RESET_PW:  { key: 'USER_RESET_PW',  label: 'تعديل كلمة مرور موظف', group: 'المستخدمين' },

  // Tickets
  TICKET_CLAIM:   { key: 'TICKET_CLAIM',   label: 'استلام التذاكر',       group: 'التذاكر' },
  TICKET_DELETE:  { key: 'TICKET_DELETE',  label: 'حذف تذكرة',            group: 'التذاكر' },
  REPLY_DELETE:   { key: 'REPLY_DELETE',   label: 'حذف ردود',             group: 'التذاكر' },

  // Billing
  INVOICE_APPROVE:{ key: 'INVOICE_APPROVE',label: 'اعتماد/رفض الفواتير',  group: 'الفواتير' },

  // Audit
  VIEW_LOGS:      { key: 'VIEW_LOGS',      label: 'عرض سجل النشاط',       group: 'السجلات' },
  VIEW_TRASH:     { key: 'VIEW_TRASH',     label: 'عرض سلة المحذوفات',    group: 'السجلات' },
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);

/**
 * Does this user have a specific permission?
 * SUPER_ADMIN always returns true (god-mode).
 */
export const hasPermission = (user, key) => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const list = Array.isArray(user.permissions) ? user.permissions : [];
  return list.includes(key);
};

/**
 * Express middleware: require a specific permission OR a privileged role.
 * Usage:
 *   router.post('/', protect, requirePermission('ASSET_CREATE', ['IT_SUPPORT','ADMIN','SUPER_ADMIN']), createAsset);
 *
 * If user has the role OR the explicit permission → proceed.
 * Otherwise → 403.
 */
export const requirePermission = (permissionKey, fallbackRoles = []) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'غير مصادق.' });
  if (fallbackRoles.includes(user.role)) return next();
  if (hasPermission(user, permissionKey)) return next();
  return res.status(403).json({
    message: 'لا تملك الصلاحية المطلوبة لهذه العملية.',
  });
};

/**
 * Same as requirePermission but accepts an array of permissions —
 * user passes if they have ANY one of them. Useful for read endpoints
 * that should be visible to anyone with any related permission.
 */
export const requireAnyPermission = (keys, fallbackRoles = []) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'غير مصادق.' });
  if (user.role === 'SUPER_ADMIN') return next();
  if (fallbackRoles.includes(user.role)) return next();
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
  if (keys.some(k => userPerms.includes(k))) return next();
  return res.status(403).json({
    message: 'لا تملك الصلاحية المطلوبة لهذه العملية.',
  });
};

// Convenience bundles for routes that should be visible to anyone with
// any related permission (read pages, dropdowns, etc.)
export const ASSET_PERMS = ['ASSET_CREATE', 'ASSET_EDIT', 'ASSET_DELETE', 'ASSET_ASSIGN'];
export const USER_PERMS = ['USER_CREATE', 'USER_DELETE', 'USER_RESET_PW'];
