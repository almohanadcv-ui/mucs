import { apiClient } from "@/lib/api-client";

export interface SavedFilterItem {
  id: string;
  name: string;
  module: string;
  filterJson: Record<string, unknown>;
  isShared: boolean;
}

export async function listSavedFilters(module: string) {
  const { data } = await apiClient.get<SavedFilterItem[]>("/saved-filters", { params: { module } });
  return data;
}

export async function createSavedFilter(input: {
  name: string;
  module: string;
  filterJson: Record<string, unknown>;
  isShared?: boolean;
}) {
  const { data } = await apiClient.post<SavedFilterItem>("/saved-filters", input);
  return data;
}

export async function deleteSavedFilter(id: string) {
  await apiClient.delete(`/saved-filters/${id}`);
}
