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
  | "jobTitle"
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
  "رقم الموظف": "employeeNo",
  "الرقم": "employeeNo",
  "employee no": "employeeNo",
  "employee number": "employeeNo",
  "emp no": "employeeNo",
  "الاسم العربي": "name",
  "اسم الموظف": "name",
  "الاسم الكامل": "name",
  "الاسم عربي": "name",
  "الاسم بالعربي": "name",
  الاسم: "name",
  name: "name",
  "arabic name": "name",
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

/** Normalize header/status text so matching survives Arabic spelling variants:
 *  strips diacritics + tatweel, unifies alef/ya/ta-marbuta/hamza, collapses
 *  whitespace. So "الإسم العربى" == "الاسم العربي". */
function norm(v: unknown): string {
  return String(v ?? "")
    .replace(/[ً-ْٰـ]/g, "") // tashkeel + superscript alef + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ة/g, "ه")
    .replace(/[_\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** HEADER_MAP keyed by normalized header text (built once). */
const NORM_HEADER_MAP: Map<string, Field> = new Map(
  Object.entries(HEADER_MAP).map(([k, v]) => [norm(k), v]),
);

/**
 * Classify a (normalized) header by keyword tokens, so descriptive real-world
 * titles map correctly — e.g. «الاسم كاملاً باللغة العربية» → name, «الإدارة
 * المسؤولة 1» → branch, «المسمى الوظيفي» → jobTitle. Order matters: more
 * specific rules come first (English name before Arabic name; nationality
 * before gender; employee-no before job-title). Falls back to the exact map.
 */
function classifyHeader(h: string): Field | null {
  const inc = (...t: string[]) => t.some((x) => h.includes(x));
  const exact = NORM_HEADER_MAP.get(h);
  if (exact) return exact;
  if (!h) return null;

  // Names
  if (inc("اسم") && inc("انجليزي", "الانجليزيه", "لاتيني", "english", "en")) return "nameEn";
  if (inc("اسم") && inc("عربي", "العربيه", "arabic")) return "name";
  // Employee number (before job title — both mention «الوظيفي»)
  if ((h.includes("الرقم") && h.includes("الوظيفي")) || inc("رقم الموظف", "employee no", "employee number", "emp no"))
    return "employeeNo";
  // Job title
  if (inc("المسمي", "المنصب", "الدرجه الوظيفيه", "job title", "position")) return "jobTitle";
  // Plain «الاسم» fallback (after the more specific name/no/title rules)
  if (inc("الاسم", "اسم الموظف")) return "name";
  // Identity
  if (inc("الجنسيه", "nationality")) return "nationality";
  if (inc("الجنس", "gender", "النوع")) return "gender";
  if (inc("الهويه", "الهويه الوطنيه", "national id", "id number")) return "nationalId";
  if (inc("البريد", "ايميل", "email", "e mail")) return "email";
  // Org
  if (inc("القسم", "department", "الوحده")) return "department";
  if (inc("الاداره", "الفرع", "branch", "division")) return "branch";
  if (inc("المدير", "المباشر", "manager", "supervisor")) return "directManager";
  // Dates
  if (inc("ميلاد", "birth")) return "birthDate";
  if (inc("الانضمام", "الالتحاق", "المباشره", "join", "hire")) return "joinedAt";
  const isStart = inc("بدايه", "start", "من تاريخ");
  const isEnd = inc("نهايه", "انتهاء", "end", "الى تاريخ");
  if (inc("تجريبيه", "التجربه", "probation")) return isEnd ? "probationEndDate" : "probationStartDate";
  if (inc("العقد", "contract")) return isEnd ? "contractEndDate" : "contractStartDate";
  // Status
  if (inc("الحاله", "حاله الموظف", "status", "الوضع")) return "status";
  return null;
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
  const s = norm(raw); // already alef/ya/ta-marbuta normalized
  if (!s) return EmployeeStatus.ACTIVE;
  if (s.includes("غير نشط") || s.includes("inactive")) return "SKIP";
  if (s.includes("اجاز") || s.includes("leave")) return EmployeeStatus.ON_LEAVE;
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

  // Find the header row: scan the first few rows (the real header isn't always
  // row 1 — files often have a title/logo row on top) and keep the row that
  // matches the most known columns.
  let colToField = new Map<number, Field>();
  let headerRowIdx = 1;
  let seenHeaders: string[] = [];
  const scanUpto = Math.min(8, ws.rowCount);
  for (let r = 1; r <= scanUpto; r++) {
    const row = ws.getRow(r);
    const map = new Map<number, Field>();
    const texts: string[] = [];
    row.eachCell((cell, col) => {
      const raw = cellText(cell);
      if (raw) texts.push(raw);
      const field = classifyHeader(norm(raw));
      if (field && ![...map.values()].includes(field)) map.set(col, field);
    });
    if (map.size > colToField.size) {
      colToField = map;
      headerRowIdx = r;
      seenHeaders = texts;
    }
  }
  const fields = [...colToField.values()];
  if (!fields.includes("employeeNo") || !fields.includes("name")) {
    const preview = seenHeaders.slice(0, 12).join("، ") || "لا شيء";
    throw AppError.validation(
      `تعذّر التعرّف على أعمدة «الرقم الوظيفي» و«الاسم العربي». الأعمدة المقروءة: ${preview}. تأكد أن صف العناوين يحتوي هذين العمودين.`,
    );
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
  for (let r = headerRowIdx + 1; r <= rowCount; r++) {
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
      jobTitle: text("jobTitle") || null,
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
