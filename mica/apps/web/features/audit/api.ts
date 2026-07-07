import type { PaginatedResult, PaginationQuery } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

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
}

export async function listAuditLog(
  query: Partial<PaginationQuery> & { entityType?: string; userId?: string },
) {
  const { data } = await apiClient.get<PaginatedResult<AuditLogItem>>("/audit-log", {
    params: query,
  });
  return data;
}
