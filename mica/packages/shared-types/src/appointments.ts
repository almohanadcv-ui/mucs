import { z } from "zod";

export const APPOINTMENT_TYPES = ["MAINTENANCE", "INSPECTION", "DELIVERY", "OTHER"] as const;
export type AppointmentTypeValue = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUSES)[number];

export const createAppointmentSchema = z.object({
  title: z.string().min(1),
  type: z.enum(APPOINTMENT_TYPES).default("OTHER"),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  maintenanceRequestId: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  branchId: z.string().min(1),
  assignedToId: z.string().optional(),
  colorTag: z.string().optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(APPOINTMENT_TYPES).optional(),
  vehicleId: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  assignedToId: z.string().nullable().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  colorTag: z.string().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
