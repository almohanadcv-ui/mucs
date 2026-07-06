import { z } from "zod";

export const DRIVER_STATUSES = ["ACTIVE", "SUSPENDED", "ON_LEAVE"] as const;
export type DriverStatusValue = (typeof DRIVER_STATUSES)[number];

export const createDriverSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  licenseNumber: z.string().min(1),
  licenseClass: z.string().optional(),
  licenseExpiryDate: z.string().datetime().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  branchId: z.string().min(1),
  userId: z.string().optional(),
});
export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = createDriverSchema
  .partial()
  .omit({ employeeCode: true })
  .extend({
    status: z.enum(DRIVER_STATUSES).optional(),
  });
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
