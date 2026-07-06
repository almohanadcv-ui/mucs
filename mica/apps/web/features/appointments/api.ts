import type { CreateAppointmentInput, UpdateAppointmentInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface AppointmentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  branchId: string;
  vehicleId: string | null;
  driverId: string | null;
  assignedToId: string | null;
  colorTag: string | null;
  vehicle: { id: string; plateNumber: string; name: string | null; make: string; model: string } | null;
  driver: { id: string; firstName: string; lastName: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}

interface ConflictInfo {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
}

export interface AppointmentMutationResult {
  appointment: AppointmentItem;
  conflicts: ConflictInfo[];
}

export async function listAppointments(start: string, end: string) {
  const { data } = await apiClient.get<AppointmentItem[]>("/appointments", {
    params: { start, end },
  });
  return data;
}

export async function createAppointment(input: CreateAppointmentInput) {
  const { data } = await apiClient.post<AppointmentMutationResult>("/appointments", input);
  return data;
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput) {
  const { data } = await apiClient.patch<AppointmentMutationResult>(`/appointments/${id}`, input);
  return data;
}

export async function deleteAppointment(id: string) {
  await apiClient.delete(`/appointments/${id}`);
}
