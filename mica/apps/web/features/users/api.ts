import type {
  CreateUserInput,
  PaginatedResult,
  PaginationQuery,
  UpdateUserInput,
} from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  branchId: string | null;
  departmentId: string | null;
  createdAt: string;
  roles: { role: { id: string; name: string } }[];
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
}

export async function listUsers(query: Partial<PaginationQuery>) {
  const { data } = await apiClient.get<PaginatedResult<UserListItem>>("/users", {
    params: query,
  });
  return data;
}

export interface CreatedUser extends UserListItem {
  setPasswordUrl: string;
  temporaryPassword: string;
}

export async function createUser(input: CreateUserInput) {
  const { data } = await apiClient.post<CreatedUser>("/users", input);
  return data;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const { data } = await apiClient.patch<UserListItem>(`/users/${id}`, input);
  return data;
}

export async function suspendUser(id: string) {
  await apiClient.post(`/users/${id}/suspend`);
}

export async function deleteUser(id: string) {
  await apiClient.delete(`/users/${id}`);
}

export async function resetUserPassword(id: string) {
  const { data } = await apiClient.post<{ email: string; setPasswordUrl: string }>(
    `/users/${id}/reset-password`,
  );
  return data;
}
