"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, qs, type PaginatedResponse } from "@/lib/api-client";
import type { TemplateQuestion } from "@/features/templates/use-templates";

export interface EvaluationRow {
  id: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  employee: { id: string; name: string; employeeNo: string } | null;
  template: { id: string; title: string } | null;
  evaluator: { id: string; name: string } | null;
  reviewer: { id: string; name: string } | null;
}

export interface EvaluationDetail extends EvaluationRow {
  template: {
    id: string;
    title: string;
    questions: TemplateQuestion[];
  } & EvaluationRow["template"];
  answers: {
    questionId: string;
    valueNumber: number | null;
    valueText: string | null;
    valueBool: boolean | null;
    valueDate: string | null;
    valueJson: unknown;
    /** Free-text note the evaluator wrote beside this answer. */
    remarks: string | null;
  }[];
}

export function useEvaluations(params: {
  page?: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["evaluations", params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<EvaluationRow>>(
        "/api/evaluations" +
          qs({ page: params.page ?? 1, status: params.status, search: params.search }),
      ),
    placeholderData: (p) => p,
  });
}

export function useEvaluation(id: string | undefined) {
  return useQuery({
    queryKey: ["evaluation", id],
    queryFn: () => apiClient.get<EvaluationDetail>(`/api/evaluations/${id}`),
    enabled: !!id,
  });
}

export function useCreateEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiClient.post<EvaluationRow>("/api/evaluations", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluations"] }),
  });
}

export function useDeleteEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del(`/api/evaluations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluations"] }),
  });
}

export function useReviewEvaluation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { decision: "APPROVE" | "REJECT"; reason?: string }) =>
      apiClient.post(`/api/evaluations/${id}/review`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      qc.invalidateQueries({ queryKey: ["evaluation", id] });
    },
  });
}
