/**
 * Domain enums — single source of truth shared by Prisma schema, Zod validators,
 * and UI. Keep string values stable (they are persisted).
 */

export const Role = {
  ADMIN: "ADMIN",
  SUPERVISOR: "SUPERVISOR",
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
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type EvaluationStatus =
  (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

/** Where an evaluation's content comes from: the question form, or an
 *  uploaded Word document that stands in as the evaluation itself. */
export const EvaluationSource = {
  FORM: "FORM",
  DOCUMENT: "DOCUMENT",
} as const;
export type EvaluationSource =
  (typeof EvaluationSource)[keyof typeof EvaluationSource];

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
