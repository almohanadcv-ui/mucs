import { z } from "zod";

export const PERMISSION_SCOPES = ["OWN", "BRANCH", "ALL"] as const;
export type PermissionScopeValue = (typeof PERMISSION_SCOPES)[number];

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  branchId: z.string().nullable().optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const setRolePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permissionId: z.string(),
      scope: z.enum(PERMISSION_SCOPES),
    }),
  ),
});
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
