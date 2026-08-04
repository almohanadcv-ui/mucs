/**
 * Domain enums — single source of truth shared by Prisma schema, Zod validators,
 * and UI. Keep string values stable (they are persisted).
 */

export const Role = {
  /** IT — unrestricted. */
  ADMIN: "ADMIN",
  /** الإدارة — oversees evaluations org-wide. */
  MANAGEMENT: "MANAGEMENT",
  /** المراجع الأساسي — final approval, the last stage. */
  PRIMARY_REVIEWER: "PRIMARY_REVIEWER",
  /** المراجع — preliminary approval / return for edit. */
  SUPERVISOR: "SUPERVISOR",
  /** المقيّم — fills evaluations for their own team. */
  EVALUATOR: "EVALUATOR",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role);

export const EmployeeStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ON_LEAVE: "ON_LEAVE",
  TERMINATED: "TERMINATED",
} as const;
export type EmployeeStatus =
  (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const EvaluationStatus = {
  DRAFT: "DRAFT",
  /** Submitted, awaiting preliminary review. */
  PENDING: "PENDING",
  /** Returned to the evaluator to fix, with a reason. */
  NEEDS_EDIT: "NEEDS_EDIT",
  /** Preliminary-approved, awaiting final review. */
  PRELIMINARY_APPROVED: "PRELIMINARY_APPROVED",
  /** Finally approved — the employee is notified/emailed here. */
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type EvaluationStatus =
  (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

/** The 11 supported question types. */
export const QuestionType = {
  STAR_RATING: "STAR_RATING",
  SINGLE_CHOICE: "SINGLE_CHOICE",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TEXT: "TEXT",
  TEXTAREA: "TEXTAREA",
  NUMBER: "NUMBER",
  DATE: "DATE",
  TIME: "TIME",
  YES_NO: "YES_NO",
  DROPDOWN: "DROPDOWN",
  FILE_UPLOAD: "FILE_UPLOAD",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];
export const QUESTION_TYPES = Object.values(QuestionType);

/**
 * The fixed «التوصية / Recommendation» section shown at the end of every
 * evaluation. Chosen by the evaluator, seen by reviewers and management — but
 * NEVER shown to the employee (kept out of their result email and PDF).
 */
export const RECOMMENDATION_OPTIONS = [
  { key: "increment", ar: "علاوة", en: "Increment" },
  { key: "promotion", ar: "ترقية", en: "Promotion" },
  { key: "dismissal", ar: "الاستغناء عنه", en: "Dismissal" },
  { key: "bonus", ar: "مكافأة", en: "Bonus" },
  { key: "no_increment", ar: "يحرم من العلاوة", en: "No Increment" },
  { key: "transfer", ar: "نقله لمكان آخر", en: "Transfer" },
] as const;
export const RECOMMENDATION_KEYS = RECOMMENDATION_OPTIONS.map((o) => o.key);
export type RecommendationKey = (typeof RECOMMENDATION_OPTIONS)[number]["key"];

/** Star rating scale labels (Arabic), 1..5. */
export const STAR_RATING_LABELS: Record<number, string> = {
  1: "ضعيف",
  2: "يحتاج تحسين",
  3: "جيد",
  4: "جيد جداً",
  5: "ممتاز",
};

export const NotificationType = {
  ASSIGNMENT: "ASSIGNMENT",
  APPROVAL: "APPROVAL",
  REJECTION: "REJECTION",
  REMINDER: "REMINDER",
  SYSTEM: "SYSTEM",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  EXPORT: "EXPORT",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
