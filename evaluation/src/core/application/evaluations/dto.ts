import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { EvaluationStatus } from "@/core/domain/enums";

export const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  // Value shape depends on the question type; validated in the domain layer.
  value: z.unknown(),
  // Free-text note beside the answer; never scored.
  remarks: z.string().trim().max(2000).optional().nullable(),
});

/** Selected «التوصية» option keys; unknown keys are dropped in the service. */
const recommendationSchema = z.array(z.string()).max(20).optional();

export const createEvaluationSchema = z.object({
  templateId: z.string().uuid(),
  employeeId: z.string().uuid(),
  answers: z.array(answerInputSchema).default([]),
  recommendation: recommendationSchema,
  // If true, submit immediately for review; otherwise save as DRAFT.
  submit: z.boolean().default(false),
});

export const updateEvaluationSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
  recommendation: recommendationSchema,
  submit: z.boolean().default(false),
});

/**
 * Review actions in the multi-stage flow:
 *  - PRELIMINARY: المراجع gives the first-stage approval (PENDING → PRELIMINARY_APPROVED)
 *  - FINAL: المراجع الأساسي gives the final approval (→ APPROVED; employee notified)
 *  - RETURN: send back to the evaluator to fix, with a reason (→ NEEDS_EDIT)
 */
export const reviewEvaluationSchema = z
  .object({
    action: z.enum(["PRELIMINARY", "FINAL", "RETURN"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "RETURN" && (!v.reason || v.reason.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "سبب الإعادة مطلوب",
        path: ["reason"],
      });
    }
  });

export const listEvaluationsSchema = paginationSchema.extend({
  status: z
    .enum([
      EvaluationStatus.DRAFT,
      EvaluationStatus.SENT_TO_EMPLOYEE,
      EvaluationStatus.EMPLOYEE_RESPONDED,
      EvaluationStatus.EMPLOYEE_ACKNOWLEDGED,
      EvaluationStatus.APPROVED,
      // legacy
      EvaluationStatus.PENDING,
      EvaluationStatus.NEEDS_EDIT,
      EvaluationStatus.PRELIMINARY_APPROVED,
      EvaluationStatus.REJECTED,
    ])
    .optional(),
  employeeId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
});

/** A manager reply, or an internal HR note, on an evaluation. */
export const evaluationCommentSchema = z.object({
  body: z.string().trim().min(1, "التعليق مطلوب").max(4000),
});

/** The employee's decision via the magic-link. OBJECT requires a comment. */
export const employeeRespondSchema = z
  .object({
    decision: z.enum(["ACKNOWLEDGE", "OBJECT"]),
    comment: z.string().trim().max(4000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "OBJECT" && (!v.comment || v.comment.length < 3)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "الرجاء كتابة ملاحظتك", path: ["comment"] });
    }
  });

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
export type ReviewEvaluationInput = z.infer<typeof reviewEvaluationSchema>;
export type ListEvaluationsInput = z.infer<typeof listEvaluationsSchema>;
export type EvaluationCommentInput = z.infer<typeof evaluationCommentSchema>;
export type EmployeeRespondInput = z.infer<typeof employeeRespondSchema>;
