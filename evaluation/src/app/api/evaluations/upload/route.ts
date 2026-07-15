import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { AppError } from "@/core/application/errors";
import { Permission } from "@/core/domain/permissions";
import { createDocumentEvaluationSchema } from "@/core/application/evaluations/dto";
import { createDocumentEvaluation } from "@/core/application/evaluations/evaluation-service";
import { DOCX_MIME, MAX_DOCX_BYTES } from "@/infrastructure/documents/docx";

export const runtime = "nodejs";

/**
 * Create an evaluation from an uploaded Word file (multipart/form-data).
 * The document becomes the evaluation body in place of the question form.
 */
export const POST = withAuth(
  async ({ user, meta, req }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw AppError.validation("تعذّر قراءة الملف المرفوع");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw AppError.validation("لم يتم إرفاق ملف");
    }
    // Size is checked before reading the body into memory.
    if (file.size > MAX_DOCX_BYTES) {
      throw AppError.validation("حجم الملف يتجاوز 5 ميجابايت");
    }
    if (file.size === 0) {
      throw AppError.validation("الملف فارغ");
    }
    // The browser-reported type is a hint, not a guarantee; the real check is
    // that mammoth can parse it as a Word document, which happens on ingest.
    if (file.type && file.type !== DOCX_MIME) {
      throw AppError.validation("الملف يجب أن يكون بصيغة Word‏ (.docx)");
    }

    const input = createDocumentEvaluationSchema.safeParse({
      employeeId: form.get("employeeId"),
      submit: form.get("submit") === "true",
    });
    if (!input.success) {
      throw AppError.validation("بيانات غير صالحة", input.error.flatten());
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const evaluation = await createDocumentEvaluation(user, meta, input.data, {
      name: file.name,
      buffer,
    });

    return ok(evaluation, { status: 201 });
  },
  { permission: Permission.EVALUATION_CREATE },
);
