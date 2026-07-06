import type { CreateSparePartInput, UpdateSparePartInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface SparePartItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unitCost: string;
  quantityOnHand: number;
  reorderThreshold: number;
  branchId: string;
}

export async function listSpareParts(branchId?: string) {
  const { data } = await apiClient.get<SparePartItem[]>("/spare-parts", { params: { branchId } });
  return data;
}

export async function createSparePart(input: CreateSparePartInput) {
  const { data } = await apiClient.post<SparePartItem>("/spare-parts", input);
  return data;
}

export async function updateSparePart(id: string, input: UpdateSparePartInput) {
  const { data } = await apiClient.patch<SparePartItem>(`/spare-parts/${id}`, input);
  return data;
}

export async function deleteSparePart(id: string) {
  await apiClient.delete(`/spare-parts/${id}`);
}
