import type { CreateBranchInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface BranchListItem {
  id: string;
  name: string;
  code: string;
  city?: string | null;
  isActive: boolean;
}

export async function listBranches() {
  const { data } = await apiClient.get<BranchListItem[]>("/branches");
  return data;
}

export async function createBranch(input: CreateBranchInput) {
  const { data } = await apiClient.post<BranchListItem>("/branches", input);
  return data;
}

export async function deleteBranch(id: string) {
  await apiClient.delete(`/branches/${id}`);
}
