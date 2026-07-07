import type { CreateDepartmentInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface DepartmentListItem {
  id: string;
  name: string;
  branchId: string;
  branch?: { id: string; name: string } | null;
}

export async function listDepartments() {
  const { data } = await apiClient.get<DepartmentListItem[]>("/departments");
  return data;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const { data } = await apiClient.post<DepartmentListItem>("/departments", input);
  return data;
}

export async function deleteDepartment(id: string) {
  await apiClient.delete(`/departments/${id}`);
}
