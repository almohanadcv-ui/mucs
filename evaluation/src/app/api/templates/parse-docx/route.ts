import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { AppError } from "@/core/application/errors";
import { Permission } from "@/core/domain/permissions";
import {
  DOCX_MIME,
  MAX_DOCX_BYTES,
  docxToTemplateDraft,
} from "@/infrastructure/documents/docx-template";

export const runtime = "nodejs";

/**
 * Read a Word evaluation form and return a draft template (criteria + their
 * options) for the reviewer to check and save.
 *
 * Writes nothing: a Word file is a layout, not a schema, so the parse is a
 * proposal. TEMPLATE_MANAGE keeps this with reviewers and admins — evaluators
 * fill templates, they don't define them.
 */
export const POST = withAuth(
  async ({ req }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw AppError.validation("تعذّر قراءة الملف المرفوع");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw AppError.validation("لم يتم إرفاق ملف");
    if (file.size === 0) throw AppError.validation("الملف فارغ");
    if (file.size > MAX_DOCX_BYTES) {
      throw AppError.validation("حجم الملف يتجاوز 5 ميجابايت");
    }
    if (file.type && file.type !== DOCX_MIME) {
      throw AppError.validation("الملف يجب أن يكون بصيغة Word‏ (.docx)");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fallbackTitle = file.name.replace(/\.docx$/i, "").trim() || "نموذج مستورد";
    return ok(await docxToTemplateDraft(buffer, fallbackTitle));
  },
  { permission: Permission.TEMPLATE_MANAGE },
);
