import type {
  CreateVehicleInput,
  PaginatedResult,
  PaginationQuery,
  UpdateVehicleInput,
} from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface VehicleListItem {
  id: string;
  name: string | null;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  status: string;
  odometer: number;
  fuelLevel: string | null;
  fuelUpdatedAt: string | null;
  fuelUpdatedByName: string | null;
  oilMeter: number | null;
  oilChangeDueAt: string | null;
  nextMaintenanceAt: string | null;
  receiverName: string | null;
  party: string | null;
  branchId: string;
  currentDriverId: string | null;
  qrCodeValue: string;
  purchasePrice: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
  currentDriver: { id: string; firstName: string; lastName: string } | null;
}

export async function listVehicles(query: Partial<PaginationQuery> & { branchId?: string; status?: string }) {
  const { data } = await apiClient.get<PaginatedResult<VehicleListItem>>("/vehicles", {
    params: query,
  });
  return data;
}

export async function getVehicle(id: string) {
  const { data } = await apiClient.get<VehicleListItem>(`/vehicles/${id}`);
  return data;
}

export async function createVehicle(input: CreateVehicleInput) {
  const { data } = await apiClient.post<VehicleListItem>("/vehicles", input);
  return data;
}

export async function updateVehicle(id: string, input: UpdateVehicleInput) {
  const { data } = await apiClient.patch<VehicleListItem>(`/vehicles/${id}`, input);
  return data;
}

export async function deleteVehicle(id: string) {
  await apiClient.delete(`/vehicles/${id}`);
}
