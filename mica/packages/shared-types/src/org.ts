import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  branchId: z.string().min(1),
  managerId: z.string().optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  managerId: z.string().nullable().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const createTeamSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1),
  leadId: z.string().optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  leadId: z.string().nullable().optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
