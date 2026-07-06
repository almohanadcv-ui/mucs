"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type PaginatedResponse } from "@/lib/api-client";

export interface BranchRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  _count?: { departments: number; employees: number };
}

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  branchId: string | null;
  branch: { id: string; name: string } | null;
  _count?: { employees: number };
}

function invalidateOrg(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["branches"] });
  qc.invalidateQueries({ queryKey: ["departments"] });
  qc.invalidateQueries({ queryKey: ["lookups"] });
}

/* ---- Branches ---- */
export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<PaginatedResponse<BranchRow>>("/api/branches?pageSize=100"),
  });
}
export function useSaveBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { id?: string; name: string; code: string; address?: string | null }) =>
      b.id
        ? apiClient.patch(`/api/branches/${b.id}`, b)
        : apiClient.post("/api/branches", b),
    onSuccess: () => invalidateOrg(qc),
  });
}
export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/branches/${id}`),
    onSuccess: () => invalidateOrg(qc),
  });
}

/* ---- Departments ---- */
export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => apiClient.get<PaginatedResponse<DepartmentRow>>("/api/departments?pageSize=100"),
  });
}
export function useSaveDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { id?: string; name: string; code: string; branchId?: string | null }) =>
      d.id
        ? apiClient.patch(`/api/departments/${d.id}`, d)
        : apiClient.post("/api/departments", d),
    onSuccess: () => invalidateOrg(qc),
  });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/departments/${id}`),
    onSuccess: () => invalidateOrg(qc),
  });
}
