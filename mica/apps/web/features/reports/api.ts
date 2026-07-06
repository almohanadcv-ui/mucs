import { apiClient } from "@/lib/api-client";

export interface MaintenanceCostRow {
  groupId: string;
  groupLabel: string;
  requestCount: number;
  totalEstimatedCost: number;
  totalActualCost: number;
}

export interface MaintenanceCostQuery {
  branchId?: string;
  from?: string;
  to?: string;
  groupBy: "vehicle" | "branch";
}

export async function getMaintenanceCostReport(query: MaintenanceCostQuery) {
  const { data } = await apiClient.get<MaintenanceCostRow[]>("/reports/maintenance-cost", {
    params: query,
  });
  return data;
}

export async function downloadMaintenanceCostReport(
  query: MaintenanceCostQuery,
  format: "csv" | "excel",
) {
  const { data } = await apiClient.get("/reports/maintenance-cost/export", {
    params: { ...query, format },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maintenance-cost-report.${format === "excel" ? "xlsx" : "csv"}`;
  link.click();
  URL.revokeObjectURL(url);
}
