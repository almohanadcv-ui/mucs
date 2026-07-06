import { db } from '../db/index.js';

export const PERMISSIONS = [
  ['view_dashboard', 'عرض لوحة التحكم', 'Dashboards'],
  ['view_reports', 'عرض التقارير', 'Reports'],
  ['create_requests', 'إنشاء الطلبات', 'Requests'],
  ['delete_requests', 'حذف الطلبات', 'Requests'],
  ['approve_requests', 'اعتماد الطلبات', 'Requests'],
  ['reject_requests', 'رفض الطلبات', 'Requests'],
  ['export_excel', 'تصدير Excel', 'Exports'],
  ['export_pdf', 'تصدير PDF', 'Exports'],
  ['export_csv', 'تصدير CSV', 'Exports'],
  ['manage_users', 'إدارة المستخدمين', 'Users'],
  ['manage_roles', 'إدارة الأدوار', 'Users'],
  ['manage_permissions', 'إدارة الصلاحيات', 'Users'],
  ['view_audit_logs', 'عرض سجل التدقيق', 'Security'],
  ['manage_whatsapp', 'إدارة واتساب', 'Automation'],
  ['manage_settings', 'إدارة الإعدادات', 'Settings'],
  ['view_statistics', 'عرض الإحصائيات', 'Analytics'],
  ['view_companies', 'عرض الشركات', 'Analytics'],
  ['view_projects', 'عرض المشاريع', 'Analytics'],
  ['manage_files', 'إدارة الملفات', 'Files'],
  ['view_system_health', 'عرض صحة النظام', 'Operations'],
  ['supervise_applicants', 'متابعة مقدمي الطلبات', 'Supervisor'],
];

const ROLE_DEFAULTS = {
  applicant: ['create_requests'],
  reviewer: ['view_dashboard', 'view_reports', 'approve_requests', 'reject_requests', 'export_excel', 'manage_files'],
  support: PERMISSIONS.map(([code]) => code),
  supervisor: ['view_dashboard', 'view_reports', 'view_statistics', 'supervise_applicants', 'manage_users', 'view_audit_logs'],
  general_management: ['view_dashboard', 'view_reports', 'view_statistics', 'export_excel', 'export_pdf', 'export_csv', 'view_system_health'],
};

export function seedPermissions() {
  const insertPerm = db.prepare(`
    INSERT INTO permissions(code, name_ar, category) VALUES(?,?,?)
    ON CONFLICT(code) DO UPDATE SET name_ar=excluded.name_ar, category=excluded.category
  `);
  for (const [code, name, category] of PERMISSIONS) insertPerm.run(code, name, category);

  const insertRolePerm = db.prepare(`
    INSERT OR IGNORE INTO role_permissions(role_id, permission_code) VALUES(?,?)
  `);
  for (const [roleCode, perms] of Object.entries(ROLE_DEFAULTS)) {
    const role = db.prepare(`SELECT id FROM roles WHERE code=?`).get(roleCode);
    if (!role) continue;
    for (const perm of perms) insertRolePerm.run(role.id, perm);
  }
}

export function getEffectivePermissions(userId) {
  return db.prepare(`
    SELECT DISTINCT p.code
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_code=p.code
    JOIN users u ON u.role_id=rp.role_id
    WHERE u.id=?
    UNION
    SELECT permission_code FROM user_permissions WHERE user_id=? AND allowed=1
  `).all(userId, userId).map((r) => r.code);
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'support') return true;
  return getEffectivePermissions(user.id).includes(permission);
}

export function permissionCatalog() {
  return db.prepare(`SELECT code, name_ar, category, description FROM permissions ORDER BY category, code`).all();
}
