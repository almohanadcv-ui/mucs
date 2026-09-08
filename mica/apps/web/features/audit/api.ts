import type { PaginatedResult, PaginationQuery } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface AuditVehicle {
  id: string;
  plateNumber: string;
  label: string;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  method: string | null;
  path: string | null;
  ipAddress: string | null;
  createdAt: string;
  // Enriched, human-readable context.
  summary: string | null;
  vehicle: AuditVehicle | null;
  driverName: string | null;
  // Full detail — every captured point, shown literally when a row is expanded.
  statusCode: number | null;
  requestId: string | null;
  userAgent: string | null;
  changesAfter: unknown;
  changesBefore: unknown;
  metadata: unknown;
}

export async function listAuditLog(
  query: Partial<PaginationQuery> & { entityType?: string; userId?: string },
) {
  const { data } = await apiClient.get<PaginatedResult<AuditLogItem>>("/audit-log", {
    params: query,
  });
  return data;
}
