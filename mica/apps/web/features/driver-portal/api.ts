import type { CreateDriverReportInput, MaintenanceStatusValue } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";
import type { AttachmentItem } from "@/features/media/api";
import type { CommentItem } from "@/features/maintenance/api";

export interface DriverVehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  name: string | null;
  year: number | null;
}

export interface DriverReportListItem {
  id: string;
  requestNumber: string;
  description: string;
  status: MaintenanceStatusValue;
  createdAt: string;
  updatedAt: string;
  vehicle: { id: string; plateNumber: string; make: string; model: string } | null;
}

export interface DriverReportDetail extends DriverReportListItem {
  comments: CommentItem[];
  attachments: AttachmentItem[];
}

export async function listMyVehicles() {
  const { data } = await apiClient.get<DriverVehicle[]>("/driver-portal/vehicles");
  return data;
}

export async function listMyReports() {
  const { data } = await apiClient.get<DriverReportListItem[]>("/driver-portal/reports");
  return data;
}

export async function getMyReport(id: string) {
  const { data } = await apiClient.get<DriverReportDetail>(`/driver-portal/reports/${id}`);
  return data;
}

export async function createMyReport(input: CreateDriverReportInput) {
  const { data } = await apiClient.post<DriverReportListItem>("/driver-portal/reports", input);
  return data;
}

export async function uploadMyReportMedia(reportId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<AttachmentItem>(
    `/driver-portal/reports/${reportId}/media`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
