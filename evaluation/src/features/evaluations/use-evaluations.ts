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
  /** DOCUMENT evaluations carry an uploaded Word file instead of answers. */
  source: "FORM" | "DOCUMENT";
  documentName: string | null;
  employee: { id: string; name: string; employeeNo: string } | null;
  template: { id: string; title: string } | null;
  evaluator: { id: string; name: string } | null;
  reviewer: { id: string; name: string } | null;
}

export interface EvaluationDetail extends EvaluationRow {
  /** Null when `source` is DOCUMENT — there is no template behind it. */
  template:
    | ({
        id: string;
        title: string;
        questions: TemplateQuestion[];
      } & NonNullable<EvaluationRow["template"]>)
    | null;
  /** Sanitized server-side; DOCUMENT evaluations only. */
  documentHtml: string | null;
  answers: {
    questionId: string;
    valueNumber: number | null;
    valueText: string | null;
    valueBool: boolean | null;
    valueDate: string | null;
    valueJson: unknown;
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

/** Create an evaluation from an uploaded Word file (multipart upload). */
export function useUploadEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; employeeId: string; submit: boolean }) => {
      const form = new FormData();
      form.set("file", args.file);
      form.set("employeeId", args.employeeId);
      form.set("submit", String(args.submit));
      return apiClient.postForm<EvaluationRow>("/api/evaluations/upload", form);
    },
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
