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
  EVALUATION_APPROVE_PRELIMINARY: "evaluation:approve_prelim", // (legacy) المراجع — اعتماد مبدئي
  EVALUATION_APPROVE_FINAL: "evaluation:approve_final", // (legacy) المراجع الأساسي — اعتماد نهائي
  EVALUATION_RETURN: "evaluation:return", // (legacy) إعادة للتعديل مع سبب
  EVALUATION_DELETE: "evaluation:delete", // IT + الإدارة only
  EVALUATION_COMMENT_HR: "evaluation:comment_hr", // HR — ملاحظات داخلية على المدير
  EVALUATION_VIEW_THREAD: "evaluation:view_thread", // HR/IT/الإدارة — أرشيف الحوار الكامل

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
 * الموارد البشرية (HR) — the former reviewers. They see every evaluation and the
 * full conversation thread, and leave internal feedback notes on the manager's
 * evaluation (which the manager can read, the employee never can). They do NOT
 * approve — approval is the manager's alone.
 */
const HR: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.TEMPLATE_VIEW,
  Permission.EVALUATION_VIEW_ALL,
  Permission.EVALUATION_VIEW_THREAD,
  Permission.EVALUATION_COMMENT_HR,
  Permission.REPORT_VIEW,
  Permission.REPORT_EXPORT,
];

/**
 * المراجع الأساسي — the final approver. Sees every evaluation, gives the final
 * approval or returns one for edit, and reads reports.
 */
const PRIMARY_REVIEWER: Permission[] = [
  Permission.EMPLOYEE_VIEW,
  Permission.TEMPLATE_VIEW,
  Permission.EVALUATION_CREATE, // reviewers may also fill evaluations
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
  Permission.EVALUATION_CREATE, // reviewers may also fill evaluations
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

/**
 * الموظف — the plainest role. Holds NO manager permission: cannot browse the
 * roster, create evaluations, or approve. Their only capability (seeing their
 * own evaluation and replying to their manager) is served by the dedicated
 * /my-evaluation page, which authorizes by the employee↔user link, not by these
 * permissions. Kept as an empty set so every manager gate denies them by default.
 */
const EMPLOYEE: Permission[] = [];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: ALL, // IT
  [Role.MANAGEMENT]: MANAGEMENT,
  [Role.HR]: HR,
  [Role.PRIMARY_REVIEWER]: PRIMARY_REVIEWER, // legacy
  [Role.SUPERVISOR]: SUPERVISOR, // legacy
  [Role.EVALUATOR]: EVALUATOR,
  [Role.EMPLOYEE]: EMPLOYEE,
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
  [Role.ADMIN]: [Role.MANAGEMENT, Role.HR, Role.EVALUATOR, Role.EMPLOYEE],
  [Role.MANAGEMENT]: [Role.HR, Role.EVALUATOR, Role.EMPLOYEE],
  [Role.HR]: [],
  [Role.PRIMARY_REVIEWER]: [], // legacy
  [Role.SUPERVISOR]: [Role.EVALUATOR], // legacy
  [Role.EVALUATOR]: [],
  [Role.EMPLOYEE]: [],
};

export function canCreateRole(actor: Role, target: Role): boolean {
  return CREATABLE_ROLES[actor].includes(target);
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

/**
 * Portal "section" keys → the permissions they unlock. The MAB portal grants
 * sections per user; these ADD to the role's permissions, so IT can let a plain
 * employee also see e.g. the reports section without changing their role.
 */
const FEATURE_PERMISSIONS: Record<string, Permission[]> = {
  evaluations: [Permission.EVALUATION_VIEW_ALL],
  employees: [Permission.EMPLOYEE_VIEW],
  templates: [Permission.TEMPLATE_VIEW, Permission.TEMPLATE_MANAGE],
  reports: [Permission.REPORT_VIEW, Permission.REPORT_EXPORT],
  // my_evaluation needs no manager permission — it's the employee's own page.
};

/** Role permissions ∪ the permissions granted by the user's portal sections. */
export function effectivePermissions(
  role: Role,
  features: string[] = [],
): ReadonlySet<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const f of features) for (const p of FEATURE_PERMISSIONS[f] ?? []) set.add(p);
  return set;
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
