"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, qs, type PaginatedResponse } from "@/lib/api-client";

export interface EmployeeRow {
  id: string;
  employeeNo: string;
  name: string;
  status: string;
  avatarUrl: string | null;
  joinedAt: string | null;
  branchId: string | null;
  departmentId: string | null;
  supervisorId: string | null;
  evaluatorId: string | null;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  supervisor: { id: string; name: string } | null;
  evaluator: { id: string; name: string } | null;
}

export interface Lookups {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string; branchId: string | null }[];
  supervisors: { id: string; name: string }[];
  evaluators: { id: string; name: string }[];
  templates: { id: string; title: string }[];
}

export interface EmployeeListParams {
  page?: number;
  search?: string;
  status?: string;
}

export function useLookups() {
  return useQuery({
    queryKey: ["lookups"],
    queryFn: () => apiClient.get<Lookups>("/api/lookups"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<EmployeeRow>>(
        "/api/employees" +
          qs({ page: params.page ?? 1, search: params.search, status: params.status }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<EmployeeRow>("/api/employees", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.patch<EmployeeRow>(`/api/employees/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
