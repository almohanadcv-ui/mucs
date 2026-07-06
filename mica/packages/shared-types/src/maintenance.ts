import { z } from "zod";

export const MAINTENANCE_STATUSES = [
  "DRAFT",
  "REPORTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "QUALITY_INSPECTION",
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type MaintenanceStatusValue = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type MaintenancePriorityValue = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_SOURCES = ["INTERNAL", "DRIVER_REPORT"] as const;
export type MaintenanceSourceValue = (typeof MAINTENANCE_SOURCES)[number];

export const APPROVAL_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ApprovalDecisionValue = (typeof APPROVAL_DECISIONS)[number];

export const createMaintenanceRequestSchema = z.object({
  vehicleId: z.string().min(1),
  branchId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(MAINTENANCE_PRIORITIES).default("MEDIUM"),
  category: z.string().optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  odometerAtRequest: z.coerce.number().int().min(0).optional(),
  scheduledDate: z.string().datetime().optional(),
});
export type CreateMaintenanceRequestInput = z.infer<typeof createMaintenanceRequestSchema>;

export const updateMaintenanceRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  category: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  actualCost: z.coerce.number().min(0).optional(),
  laborHours: z.coerce.number().min(0).optional(),
  scheduledDate: z.string().datetime().optional(),
});
export type UpdateMaintenanceRequestInput = z.infer<typeof updateMaintenanceRequestSchema>;

export const transitionRequestSchema = z.object({
  toStatus: z.enum(MAINTENANCE_STATUSES),
  note: z.string().optional(),
});
export type TransitionRequestInput = z.infer<typeof transitionRequestSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  comment: z.string().optional(),
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export const createDriverReportSchema = z.object({
  vehicleId: z.string().min(1),
  description: z.string().min(1),
});
export type CreateDriverReportInput = z.infer<typeof createDriverReportSchema>;

export const addCommentSchema = z.object({
  body: z.string().min(1),
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;
