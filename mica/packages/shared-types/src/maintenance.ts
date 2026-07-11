import { z } from "zod";

// Simplified workflow: Draft → Pending approval → Approved → In progress →
// Completed → Delivered, with Cancelled reachable from any active state.
export const MAINTENANCE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type MaintenanceStatusValue = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatusValue, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  APPROVED: "تم الاعتماد",
  IN_PROGRESS: "جاري التنفيذ",
  COMPLETED: "مكتمل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

export const MAINTENANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type MaintenancePriorityValue = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_PRIORITY_META: Record<
  MaintenancePriorityValue,
  { label: string; dot: string }
> = {
  LOW: { label: "منخفضة", dot: "#22c55e" },
  MEDIUM: { label: "متوسطة", dot: "#f59e0b" },
  HIGH: { label: "عالية", dot: "#ef4444" },
  CRITICAL: { label: "حرجة", dot: "#a855f7" },
};

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

export const MAINTENANCE_REPORT_TYPES = ["PERIODIC_MAINTENANCE", "VEHICLE_FAULT"] as const;
export type MaintenanceReportTypeValue = (typeof MAINTENANCE_REPORT_TYPES)[number];
export const MAINTENANCE_REPORT_TYPE_LABELS: Record<
  MaintenanceReportTypeValue,
  { ar: string; en: string }
> = {
  PERIODIC_MAINTENANCE: { ar: "صيانة دورية", en: "Periodic maintenance" },
  VEHICLE_FAULT: { ar: "عطل في المركبة", en: "Vehicle fault" },
};

export const createDriverReportSchema = z.object({
  vehicleId: z.string().min(1),
  description: z.string().min(1),
  reportType: z.enum(MAINTENANCE_REPORT_TYPES).optional(),
});
export type CreateDriverReportInput = z.infer<typeof createDriverReportSchema>;

export const addCommentSchema = z.object({
  body: z.string().min(1),
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;
