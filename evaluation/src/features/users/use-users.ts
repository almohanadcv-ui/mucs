"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, qs, type PaginatedResponse } from "@/lib/api-client";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function useUsers(params: { page?: number; role?: string; search?: string }) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<UserRow>>(
        "/api/users" + qs({ page: params.page ?? 1, role: params.role, search: params.search }),
      ),
    placeholderData: (p) => p,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiClient.post<UserRow>("/api/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["lookups"] });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiClient.patch<UserRow>(`/api/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
