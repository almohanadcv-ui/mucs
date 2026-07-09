import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { AppError } from "@/core/application/errors";
import { Permission } from "@/core/domain/permissions";
import { importEmployeesFromExcel } from "@/core/application/employees/import-service";

export const runtime = "nodejs";
export const maxDuration = 300; // large master files can take a while to parse + upsert

/** ADMIN-only: import/refresh the master employee file from an .xlsx upload. */
export const POST = withAuth(
  async ({ user, meta, req }) => {
    const form = await req.formData().catch(() => {
      throw AppError.validation("يجب إرسال ملف Excel");
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw AppError.validation("لم يتم إرفاق ملف");
    const buffer = Buffer.from(await file.arrayBuffer());
    return ok(await importEmployeesFromExcel(user, meta, buffer));
  },
  { permission: Permission.EMPLOYEE_IMPORT },
);
