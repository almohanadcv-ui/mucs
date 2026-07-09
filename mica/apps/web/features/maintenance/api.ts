import type {
  CreateMaintenanceRequestInput,
  MaintenanceReportTypeValue,
  MaintenanceStatusValue,
  PaginatedResult,
  PaginationQuery,
  UpdateMaintenanceRequestInput,
} from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface MaintenanceListItem {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  status: MaintenanceStatusValue;
  reportType: MaintenanceReportTypeValue | null;
  priority: string;
  estimatedCost: string | null;
  actualCost: string | null;
  scheduledDate: string | null;
  createdAt: string;
  vehicle: { id: string; plateNumber: string; make: string; model: string } | null;
  reportedBy: { id: string; firstName: string; lastName: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  branch: { id: string; name: string } | null;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: MaintenanceStatusValue | null;
  toStatus: MaintenanceStatusValue;
  changedById: string | null;
  note: string | null;
  changedAt: string;
}

export interface ApprovalEntry {
  id: string;
  level: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approverUserId: string | null;
  decidedAt: string | null;
  comment: string | null;
}

export async function listMaintenanceRequests(
  query: Partial<PaginationQuery> & { status?: string; branchId?: string; vehicleId?: string },
) {
  const { data } = await apiClient.get<PaginatedResult<MaintenanceListItem>>("/maintenance", {
    params: query,
  });
  return data;
}

export async function getMaintenanceRequest(id: string) {
  const { data } = await apiClient.get<MaintenanceListItem>(`/maintenance/${id}`);
  return data;
}

export async function createMaintenanceRequest(input: CreateMaintenanceRequestInput) {
  const { data } = await apiClient.post<MaintenanceListItem>("/maintenance", input);
  return data;
}

export async function updateMaintenanceRequest(id: string, input: UpdateMaintenanceRequestInput) {
  const { data } = await apiClient.patch<MaintenanceListItem>(`/maintenance/${id}`, input);
  return data;
}

export async function transitionMaintenanceRequest(
  id: string,
  toStatus: MaintenanceStatusValue,
  note?: string,
) {
  const { data } = await apiClient.post<MaintenanceListItem>(`/maintenance/${id}/transition`, {
    toStatus,
    note,
  });
  return data;
}

export async function getMaintenanceHistory(id: string) {
  const { data } = await apiClient.get<StatusHistoryEntry[]>(`/maintenance/${id}/history`);
  return data;
}

export async function getMaintenanceApprovals(id: string) {
  const { data } = await apiClient.get<ApprovalEntry[]>(`/maintenance/${id}/approvals`);
  return data;
}

export async function decideApproval(
  id: string,
  level: number,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
) {
  const { data } = await apiClient.post(`/maintenance/${id}/approvals/${level}/decide`, {
    decision,
    comment,
  });
  return data;
}

export interface SparePartUsage {
  id: string;
  quantityUsed: number;
  unitCostAtUse: string;
  sparePart: { id: string; name: string; sku: string };
}

export async function listSparePartUsage(id: string) {
  const { data } = await apiClient.get<SparePartUsage[]>(`/maintenance/${id}/spare-parts`);
  return data;
}

export async function consumeSparePart(id: string, sparePartId: string, quantityUsed: number) {
  const { data } = await apiClient.post(`/maintenance/${id}/spare-parts`, {
    sparePartId,
    quantityUsed,
  });
  return data;
}

export interface CommentItem {
  id: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

export async function listComments(id: string) {
  const { data } = await apiClient.get<CommentItem[]>(`/maintenance/${id}/comments`);
  return data;
}

export async function addComment(id: string, body: string) {
  const { data } = await apiClient.post<CommentItem>(`/maintenance/${id}/comments`, { body });
  return data;
}
