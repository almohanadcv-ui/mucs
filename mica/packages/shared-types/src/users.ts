import { z } from "zod";

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "INVITED"] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  roleIds: z.array(z.string()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  status: z.enum(USER_STATUSES).optional(),
  roleIds: z.array(z.string()).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
