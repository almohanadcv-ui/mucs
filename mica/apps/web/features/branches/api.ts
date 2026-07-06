import { apiClient } from "@/lib/api-client";

export interface BranchListItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export async function listBranches() {
  const { data } = await apiClient.get<BranchListItem[]>("/branches");
  return data;
}
