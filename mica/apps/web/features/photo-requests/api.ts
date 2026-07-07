import { apiClient } from "@/lib/api-client";
import type { AttachmentItem } from "@/features/media/api";

export interface PhotoRequestItem {
  id: string;
  vehicleId: string;
  driverId: string;
  message: string;
  status: "PENDING" | "ANSWERED" | "CANCELLED";
  requestedByName: string | null;
  replyNote: string | null;
  answeredAt: string | null;
  createdAt: string;
  attachments?: AttachmentItem[];
}

/** Mechanic / Manager: ask a vehicle's driver to photograph the meters. */
export async function createPhotoRequest(vehicleId: string, message: string) {
  const { data } = await apiClient.post<PhotoRequestItem>("/photo-requests", {
    vehicleId,
    message,
  });
  return data;
}

/** Driver: my incoming photo requests (with any reply photos). */
export async function listMyPhotoRequests() {
  const { data } = await apiClient.get<PhotoRequestItem[]>("/photo-requests/mine");
  return data;
}

/** Mechanic / Manager: a vehicle's photo requests, each with the driver's reply. */
export async function listVehiclePhotoRequests(vehicleId: string) {
  const { data } = await apiClient.get<PhotoRequestItem[]>(`/photo-requests/vehicle/${vehicleId}`);
  return data;
}

/** Driver: reply with photos (+ optional note). */
export async function replyToPhotoRequest(id: string, files: File[], note?: string) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (note) form.append("note", note);
  const { data } = await apiClient.post(`/photo-requests/${id}/reply`, form);
  return data;
}
