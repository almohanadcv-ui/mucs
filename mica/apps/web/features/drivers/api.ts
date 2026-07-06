import type {
  CreateDriverInput,
  PaginatedResult,
  PaginationQuery,
  UpdateDriverInput,
} from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface DriverListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  licenseExpiryDate: string | null;
  phone: string | null;
  status: string;
  branchId: string;
  userId: string | null;
  branch: { id: string; name: string } | null;
}

export async function listDrivers(query: Partial<PaginationQuery> & { branchId?: string }) {
  const { data } = await apiClient.get<PaginatedResult<DriverListItem>>("/drivers", {
    params: query,
  });
  return data;
}

export async function createDriver(input: CreateDriverInput) {
  const { data } = await apiClient.post<DriverListItem>("/drivers", input);
  return data;
}

export async function updateDriver(id: string, input: UpdateDriverInput) {
  const { data } = await apiClient.patch<DriverListItem>(`/drivers/${id}`, input);
  return data;
}

export async function deleteDriver(id: string) {
  await apiClient.delete(`/drivers/${id}`);
}
