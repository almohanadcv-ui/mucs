import { apiClient } from "@/lib/api-client";

export interface DeletedVehicle {
  id: string;
  plateNumber: string;
  name: string | null;
  make: string;
  model: string;
  year: number;
  deletedAt: string | null;
  branch: { id: string; name: string } | null;
}

export interface DeletedInvoice {
  id: string;
  amount: string;
  workshopName: string | null;
  status: string;
  deletedAt: string | null;
  vehicle: { id: string; plateNumber: string; name: string | null } | null;
}

export async function listDeletedVehicles() {
  const { data } = await apiClient.get<DeletedVehicle[]>("/vehicles/deleted");
  return data;
}

export async function restoreVehicle(id: string) {
  await apiClient.post(`/vehicles/${id}/restore`);
}

export async function listDeletedInvoices() {
  const { data } = await apiClient.get<DeletedInvoice[]>("/invoices/deleted");
  return data;
}

export async function restoreInvoice(id: string) {
  await apiClient.post(`/invoices/${id}/restore`);
}
