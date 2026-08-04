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
  EMPLOYEE_IMPORT: "employee:import", // ADMIN only — import/edit the master file
  MANAGER_CREATE: "manager:create", // create an evaluator/manager login + auto-link their team

  // Templates
  TEMPLATE_VIEW: "template:view",
  TEMPLATE_MANAGE: "template:manage",

  // Evaluations
  EVALUATION_CREATE: "evaluation:create",
  EVALUATION_VIEW_OWN: "evaluation:view_own",
  EVALUATION_VIEW_TEAM: "evaluation:view_team",
  EVALUATION_VIEW_ALL: "evaluation:view_all",
  EVALUATION_APPROVE_PRELIMINARY: "evaluation:approve_prelim", // المراجع — اعتماد مبدئي
  EVALUATION_APPROVE_FINAL: "evaluation:approve_final", // المراجع الأساسي — اعتماد نهائي
  EVALUATION_RETURN: "evaluation:return", // إعادة للتعديل مع سبب
  EVALUATION_DELETE: "evaluation:delete", // IT + الإدارة only

  // Reports
  REPORT_VIEW: "report:view",
  REPORT_EXPORT: "report:export",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL: Permission[] = Object.values(Permission);

/**
 * الإدارة — every permission EXCEPT the activity log and user management. It can
 * therefore approve at either stage (and short-circuit the two-stage flow),
 * manage employees/templates, import, export and configure — but not read the
 * audit trail or create/edit login accounts.
 */
const MANAGEMENT: Permission[] = ALL.filter(
  (p) => p !== Permission.AUDIT_VIEW && p !== Permission.USER_MANAGE,
);

/**
 * المراجع الأساسي — the final approver. Sees every evaluation, gives the final
 * approval or returns one for edit, and reads reports.
 */
const PRIMARY_REVIEWER: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.TEMPLATE_VIEW,
  Permission.EVALUATION_VIEW_ALL,
  Permission.EVALUATION_APPROVE_FINAL,
  Permission.EVALUATION_RETURN,
  Permission.REPORT_VIEW,
  Permission.REPORT_EXPORT,
];

/** المراجع — preliminary approval / return for edit; sees the whole roster. */
const SUPERVISOR: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.EMPLOYEE_MANAGE,
  Permission.MANAGER_CREATE,
  Permission.TEMPLATE_VIEW,
  Permission.TEMPLATE_MANAGE,
  Permission.EVALUATION_VIEW_ALL,
  Permission.EVALUATION_APPROVE_PRELIMINARY,
  Permission.EVALUATION_RETURN,
  Permission.REPORT_VIEW,
  Permission.REPORT_EXPORT,
];

const EVALUATOR: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.EMPLOYEE_MANAGE, // can add employees (auto-linked to themselves)
  Permission.TEMPLATE_VIEW, // needed to pick a template when creating an evaluation
  Permission.EVALUATION_CREATE,
  Permission.EVALUATION_VIEW_OWN,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: ALL, // IT
  [Role.MANAGEMENT]: MANAGEMENT,
  [Role.PRIMARY_REVIEWER]: PRIMARY_REVIEWER,
  [Role.SUPERVISOR]: SUPERVISOR,
  [Role.EVALUATOR]: EVALUATOR,
};

/** Any permission that lets a user act on the review queue. */
export const REVIEW_PERMISSIONS: Permission[] = [
  Permission.EVALUATION_APPROVE_PRELIMINARY,
  Permission.EVALUATION_APPROVE_FINAL,
  Permission.EVALUATION_RETURN,
];

/**
 * Which roles a given role may create accounts for. A role can never create one
 * at or above its own level — that is how privilege escalation happens.
 */
export const CREATABLE_ROLES: Record<Role, Role[]> = {
  [Role.ADMIN]: [Role.MANAGEMENT, Role.PRIMARY_REVIEWER, Role.SUPERVISOR, Role.EVALUATOR],
  [Role.MANAGEMENT]: [Role.PRIMARY_REVIEWER, Role.SUPERVISOR, Role.EVALUATOR],
  [Role.PRIMARY_REVIEWER]: [],
  [Role.SUPERVISOR]: [Role.EVALUATOR],
  [Role.EVALUATOR]: [],
};

export function canCreateRole(actor: Role, target: Role): boolean {
  return CREATABLE_ROLES[actor].includes(target);
}

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
