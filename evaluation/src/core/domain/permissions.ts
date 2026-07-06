import { Role } from "./enums";

/**
 * Fine-grained permissions. Roles map to permission sets; UI and API both
 * authorize against permissions (never against role strings directly), so new
 * roles or custom permission sets can be added later without touching call sites.
 */
export const Permission = {
  // Users & system
  USER_MANAGE: "user:manage",
  SYSTEM_SETTINGS: "system:settings",
  BACKUP_MANAGE: "backup:manage",
  AUDIT_VIEW: "audit:view",

  // Org
  BRANCH_MANAGE: "branch:manage",
  DEPARTMENT_MANAGE: "department:manage",

  // Employees
  EMPLOYEE_VIEW: "employee:view",
  EMPLOYEE_VIEW_TEAM: "employee:view_team",
  EMPLOYEE_MANAGE: "employee:manage",

  // Templates
  TEMPLATE_VIEW: "template:view",
  TEMPLATE_MANAGE: "template:manage",

  // Evaluations
  EVALUATION_CREATE: "evaluation:create",
  EVALUATION_VIEW_OWN: "evaluation:view_own",
  EVALUATION_VIEW_TEAM: "evaluation:view_team",
  EVALUATION_VIEW_ALL: "evaluation:view_all",
  EVALUATION_REVIEW: "evaluation:review", // approve / reject

  // Reports
  REPORT_VIEW: "report:view",
  REPORT_EXPORT: "report:export",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL: Permission[] = Object.values(Permission);

const SUPERVISOR: Permission[] = [
  Permission.EMPLOYEE_VIEW_TEAM,
  Permission.EMPLOYEE_MANAGE,
  Permission.TEMPLATE_VIEW,
  Permission.TEMPLATE_MANAGE,
  Permission.EVALUATION_VIEW_TEAM,
  Permission.EVALUATION_REVIEW,
  Permission.REPORT_VIEW,
  Permission.REPORT_EXPORT,
];

const EVALUATOR: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.TEMPLATE_VIEW,
  Permission.EVALUATION_CREATE,
  Permission.EVALUATION_VIEW_OWN,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: ALL,
  [Role.SUPERVISOR]: SUPERVISOR,
  [Role.EVALUATOR]: EVALUATOR,
};

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).has(permission);
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  const set = permissionsFor(role);
  return permissions.some((p) => set.has(p));
}

export function canAll(role: Role, permissions: Permission[]): boolean {
  const set = permissionsFor(role);
  return permissions.every((p) => set.has(p));
}
