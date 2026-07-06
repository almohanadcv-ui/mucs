import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { QuestionType } from "@/core/domain/enums";

const questionTypeEnum = z.enum([
  QuestionType.STAR_RATING,
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TEXT,
  QuestionType.TEXTAREA,
  QuestionType.NUMBER,
  QuestionType.DATE,
  QuestionType.TIME,
  QuestionType.YES_NO,
  QuestionType.DROPDOWN,
  QuestionType.FILE_UPLOAD,
]);

/** A selectable option. `score` (0..1) lets choices contribute to the total. */
export const optionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(200),
  score: z.number().min(0).max(1).optional(),
});

/**
 * Per-type question configuration. Extra keys are ignored by types that don't
 * use them; validation of *required* keys per type happens in refineConfig.
 */
export const questionConfigSchema = z
  .object({
    weight: z.number().min(0).max(100).optional(),
    max: z.number().int().min(1).max(10).optional(), // STAR_RATING scale
    min: z.number().optional(), // NUMBER
    numberMax: z.number().optional(), // NUMBER upper bound (for scoring)
    maxLength: z.number().int().min(1).max(10_000).optional(), // TEXT/TEXTAREA
    options: z.array(optionSchema).max(50).optional(), // choice types
    accept: z.array(z.string().max(40)).max(20).optional(), // FILE_UPLOAD
    maxSizeMB: z.number().min(1).max(50).optional(), // FILE_UPLOAD
  })
  .strict();

export const questionInputSchema = z
  .object({
    type: questionTypeEnum,
    label: z.string().trim().min(1, "نص السؤال مطلوب").max(300),
    helpText: z.string().trim().max(500).optional().nullable(),
    required: z.boolean().default(false),
    order: z.number().int().min(0).default(0),
    config: questionConfigSchema.optional(),
  })
  .superRefine((q, ctx) => {
    const choiceTypes: string[] = [
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.DROPDOWN,
    ];
    if (choiceTypes.includes(q.type)) {
      if (!q.config?.options || q.config.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "أسئلة الاختيار تتطلب خيارين على الأقل",
          path: ["config", "options"],
        });
      }
    }
  });

export const createTemplateSchema = z.object({
  title: z.string().trim().min(2, "عنوان النموذج مطلوب").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
  questions: z.array(questionInputSchema).min(1, "أضف سؤالاً واحداً على الأقل").max(200),
});

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  // When provided, replaces the full question set (versioned edit).
  questions: z.array(questionInputSchema).min(1).max(200).optional(),
});

export const listTemplatesSchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
