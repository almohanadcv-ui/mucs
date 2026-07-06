import type { CreateRoleInput, SetRolePermissionsInput, UpdateRoleInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface PermissionItem {
  id: string;
  resource: string;
  action: string;
  key: string;
}

export interface PermissionGroup {
  resource: string;
  permissions: PermissionItem[];
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  branchId: string | null;
  permissions: { permission: PermissionItem; scope: string }[];
  _count: { users: number };
}

export async function listPermissionGroups() {
  const { data } = await apiClient.get<PermissionGroup[]>("/roles-permissions/permissions");
  return data;
}

export async function listRoles() {
  const { data } = await apiClient.get<RoleListItem[]>("/roles-permissions/roles");
  return data;
}

export async function createRole(input: CreateRoleInput) {
  const { data } = await apiClient.post<RoleListItem>("/roles-permissions/roles", input);
  return data;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const { data } = await apiClient.patch<RoleListItem>(`/roles-permissions/roles/${id}`, input);
  return data;
}

export async function deleteRole(id: string) {
  await apiClient.delete(`/roles-permissions/roles/${id}`);
}

export async function setRolePermissions(id: string, input: SetRolePermissionsInput) {
  await apiClient.put(`/roles-permissions/roles/${id}/permissions`, input);
}
