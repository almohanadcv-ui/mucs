import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { EvaluationStatus } from "@/core/domain/enums";

export const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  // Value shape depends on the question type; validated in the domain layer.
  value: z.unknown(),
});

export const createEvaluationSchema = z.object({
  templateId: z.string().uuid(),
  employeeId: z.string().uuid(),
  answers: z.array(answerInputSchema).default([]),
  // If true, submit immediately for review; otherwise save as DRAFT.
  submit: z.boolean().default(false),
});

export const updateEvaluationSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
  submit: z.boolean().default(false),
});

/**
 * Creating an evaluation from an uploaded Word file. The file itself arrives as
 * multipart form-data; these are the accompanying fields.
 */
export const createDocumentEvaluationSchema = z.object({
  employeeId: z.string().uuid(),
  submit: z.boolean().default(false),
});

export const reviewEvaluationSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "REJECT" && (!v.reason || v.reason.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "سبب الرفض مطلوب",
        path: ["reason"],
      });
    }
  });

export const listEvaluationsSchema = paginationSchema.extend({
  status: z
    .enum([
      EvaluationStatus.DRAFT,
      EvaluationStatus.PENDING,
      EvaluationStatus.APPROVED,
      EvaluationStatus.REJECTED,
    ])
    .optional(),
  employeeId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type CreateDocumentEvaluationInput = z.infer<
  typeof createDocumentEvaluationSchema
>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
export type ReviewEvaluationInput = z.infer<typeof reviewEvaluationSchema>;
export type ListEvaluationsInput = z.infer<typeof listEvaluationsSchema>;
