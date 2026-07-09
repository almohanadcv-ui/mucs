import ExcelJS from "exceljs";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction, EmployeeStatus } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";

/** Canonical field keys we import, mapped from many possible header spellings. */
type Field =
  | "employeeNo"
  | "name"
  | "nameEn"
  | "email"
  | "nationalId"
  | "nationality"
  | "gender"
  | "department"
  | "branch"
  | "directManager"
  | "birthDate"
  | "joinedAt"
  | "contractStartDate"
  | "contractEndDate"
  | "probationStartDate"
  | "probationEndDate"
  | "status";

/** Header text (normalized) → field. Supports Arabic + common English. */
const HEADER_MAP: Record<string, Field> = {
  "الرقم الوظيفي": "employeeNo",
  "employee no": "employeeNo",
  "employee number": "employeeNo",
  "الاسم العربي": "name",
  الاسم: "name",
  name: "name",
  "الاسم الإنجليزي": "nameEn",
  "name en": "nameEn",
  "البريد الإلكتروني": "email",
  البريد: "email",
  email: "email",
  "رقم الهوية": "nationalId",
  الهوية: "nationalId",
  "national id": "nationalId",
  الجنسية: "nationality",
  nationality: "nationality",
  الجنس: "gender",
  gender: "gender",
  القسم: "department",
  department: "department",
  الإدارة: "branch",
  الاداره: "branch",
  branch: "branch",
  "المدير المباشر": "directManager",
  "direct manager": "directManager",
  "تاريخ الميلاد": "birthDate",
  "birth date": "birthDate",
  "تاريخ الانضمام": "joinedAt",
  "join date": "joinedAt",
  "تاريخ بداية العقد": "contractStartDate",
  "تاريخ نهاية العقد": "contractEndDate",
  "تاريخ بداية التجربة": "probationStartDate",
  "تاريخ نهاية التجربة": "probationEndDate",
  "حالة الموظف": "status",
  الحالة: "status",
  status: "status",
};

function norm(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if ("text" in v && typeof v.text === "string") return v.text; // rich text / hyperlink
    if ("result" in v) return String((v as { result: unknown }).result ?? "");
  }
  return String(v).trim();
}

function toDate(cell: ExcelJS.Cell | undefined): Date | null {
  if (!cell) return null;
  const v = cell.value;
  if (v instanceof Date) return v;
  const s = cellText(cell);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function mapStatus(raw: string): EmployeeStatus | "SKIP" {
  const s = norm(raw);
  if (!s) return EmployeeStatus.ACTIVE;
  if (s.includes("غير نشط") || s === "inactive" || s.includes("inactive")) return "SKIP";
  if (s.includes("إجاز") || s.includes("اجاز") || s.includes("leave")) return EmployeeStatus.ON_LEAVE;
  if (s.includes("منتهي") || s.includes("terminat")) return EmployeeStatus.TERMINATED;
  return EmployeeStatus.ACTIVE;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skippedInactive: number;
  skippedInvalid: number;
}

/**
 * Import the company's master employee file. Rows marked Inactive / غير نشط are
 * skipped entirely. Existing employees (same employeeNo) are updated; the rest
 * are created. Branches (الإدارة) and departments (القسم) are resolved/created
 * by name within the tenant. ADMIN-only (enforced at the route).
 */
export async function importEmployeesFromExcel(
  user: SessionUser,
  meta: RequestMeta,
  buffer: Buffer,
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw AppError.validation("الملف لا يحتوي على أي ورقة عمل");

  // Build a column-index → field map from the header row.
  const colToField = new Map<number, Field>();
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const field = HEADER_MAP[norm(cellText(cell))];
    if (field) colToField.set(col, field);
  });
  if (![...colToField.values()].includes("employeeNo") || ![...colToField.values()].includes("name")) {
    throw AppError.validation("يجب أن يحتوي الملف على عمودي «الرقم الوظيفي» و«الاسم العربي» على الأقل");
  }

  const result: ImportResult = {
    total: 0,
    created: 0,
    updated: 0,
    skippedInactive: 0,
    skippedInvalid: 0,
  };

  // Cache branch/department ids by name so we don't hit the DB per row.
  const branchCache = new Map<string, string>();
  const deptCache = new Map<string, string>();

  const genCode = (name: string) =>
    (name.replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 16).toUpperCase() || "ORG") +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  const resolveBranch = async (name: string): Promise<string | null> => {
    const key = name.trim();
    if (!key) return null;
    if (branchCache.has(key)) return branchCache.get(key)!;
    const found = await prisma.branch.findFirst({
      where: { tenantId: user.tenantId, name: key, deletedAt: null },
      select: { id: true },
    });
    const id =
      found?.id ??
      (
        await prisma.branch.create({
          data: { tenantId: user.tenantId, name: key, code: genCode(key) },
          select: { id: true },
        })
      ).id;
    branchCache.set(key, id);
    return id;
  };
  const resolveDept = async (name: string, branchId: string | null): Promise<string | null> => {
    const key = name.trim();
    if (!key) return null;
    if (deptCache.has(key)) return deptCache.get(key)!;
    const found = await prisma.department.findFirst({
      where: { tenantId: user.tenantId, name: key, deletedAt: null },
      select: { id: true },
    });
    const id =
      found?.id ??
      (
        await prisma.department.create({
          data: {
            tenantId: user.tenantId,
            name: key,
            code: genCode(key),
            branchId: branchId ?? undefined,
          },
          select: { id: true },
        })
      ).id;
    deptCache.set(key, id);
    return id;
  };

  const rowCount = ws.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const get = (field: Field): ExcelJS.Cell | undefined => {
      for (const [col, f] of colToField) if (f === field) return row.getCell(col);
      return undefined;
    };
    const text = (field: Field) => cellText(get(field) ?? ({ value: null } as ExcelJS.Cell));

    const employeeNo = text("employeeNo").trim();
    const name = text("name").trim();
    if (!employeeNo && !name) continue; // blank row
    result.total++;

    const status = mapStatus(text("status"));
    if (status === "SKIP") {
      result.skippedInactive++;
      continue;
    }
    if (!employeeNo || !name) {
      result.skippedInvalid++;
      continue;
    }

    const branchId = await resolveBranch(text("branch"));
    const departmentId = await resolveDept(text("department"), branchId);

    const data = {
      name,
      nameEn: text("nameEn") || null,
      email: text("email") || null,
      nationalId: text("nationalId") || null,
      nationality: text("nationality") || null,
      gender: text("gender") || null,
      directManager: text("directManager") || null,
      status,
      branchId: branchId ?? undefined,
      departmentId: departmentId ?? undefined,
      birthDate: toDate(get("birthDate")),
      joinedAt: toDate(get("joinedAt")),
      contractStartDate: toDate(get("contractStartDate")),
      contractEndDate: toDate(get("contractEndDate")),
      probationStartDate: toDate(get("probationStartDate")),
      probationEndDate: toDate(get("probationEndDate")),
    };

    const existing = await prisma.employee.findFirst({
      where: { tenantId: user.tenantId, employeeNo, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.employee.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await prisma.employee.create({
        data: { tenantId: user.tenantId, employeeNo, ...data },
      });
      result.created++;
    }
  }

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "EmployeeImport",
    entityId: user.tenantId,
    after: result,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return result;
}
