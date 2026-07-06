import { apiClient } from "@/lib/api-client";

export interface SearchResults {
  vehicles: { id: string; plateNumber: string; make: string; model: string; score: number }[];
  drivers: { id: string; firstName: string; lastName: string; employeeCode: string; score: number }[];
  maintenanceRequests: { id: string; requestNumber: string; title: string; score: number }[];
}

export async function globalSearch(query: string) {
  const { data } = await apiClient.get<SearchResults>("/search", { params: { q: query } });
  return data;
}
