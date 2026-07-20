"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, qs, type PaginatedResponse } from "@/lib/api-client";

export interface TemplateQuestion {
  id?: string;
  type: string;
  label: string;
  helpText?: string | null;
  required: boolean;
  order: number;
  config?: {
    weight?: number;
    max?: number;
    min?: number;
    numberMax?: number;
    maxLength?: number;
    options?: { value: string; label: string; score?: number }[];
    accept?: string[];
    maxSizeMB?: number;
    /** Show a free-text «ملاحظات» box beside this question. */
    allowRemarks?: boolean;
  } | null;
}

export interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdBy?: { name: string };
  _count?: { questions: number; evaluations: number };
}

export interface TemplateDetail extends TemplateRow {
  questions: TemplateQuestion[];
}

export function useTemplates(params: { page?: number; search?: string }) {
  return useQuery({
    queryKey: ["templates", params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<TemplateRow>>(
        "/api/templates" + qs({ page: params.page ?? 1, search: params.search }),
      ),
    placeholderData: (p) => p,
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => apiClient.get<TemplateDetail>(`/api/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiClient.post<TemplateDetail>("/api/templates", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiClient.patch<TemplateDetail>(`/api/templates/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["template", id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
