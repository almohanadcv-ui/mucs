import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { Role } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";

export interface EvaluationReportRow {
  employeeName: string;
  employeeNo: string;
  department: string;
  branch: string;
  template: string;
  evaluator: string;
  reviewer: string;
  status: string;
  score: number | null;
  submittedAt: string;
  reviewedAt: string;
}

const STATUS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
};

function scope(user: SessionUser): Prisma.EvaluationWhereInput {
  switch (user.role) {
    case Role.ADMIN:
      return {};
    case Role.SUPERVISOR:
      return { employee: { supervisorId: user.id } };
    case Role.EVALUATOR:
      return { evaluatorId: user.id };
    default:
      return { id: "__none__" };
  }
}

export async function getEvaluationReport(
  user: SessionUser,
  filters: { status?: string; from?: Date; to?: Date },
): Promise<EvaluationReportRow[]> {
  const rows = await prisma.evaluation.findMany({
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      ...scope(user),
      ...(filters.status ? { status: filters.status as Prisma.EnumEvaluationStatusFilter } : {}),
      ...(filters.from || filters.to
        ? { submittedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      employee: {
        select: {
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      template: { select: { title: true } },
      evaluator: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
    take: 5000,
  });

  return rows.map((e) => ({
    employeeName: e.employee?.name ?? "",
    employeeNo: e.employee?.employeeNo ?? "",
    department: e.employee?.department?.name ?? "",
    branch: e.employee?.branch?.name ?? "",
    template: e.template?.title ?? "",
    evaluator: e.evaluator?.name ?? "",
    reviewer: e.reviewer?.name ?? "",
    status: STATUS_AR[e.status] ?? e.status,
    score: e.score,
    submittedAt: e.submittedAt ? e.submittedAt.toISOString().slice(0, 10) : "",
    reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString().slice(0, 10) : "",
  }));
}

export const REPORT_COLUMNS: { key: keyof EvaluationReportRow; header: string }[] = [
  { key: "employeeName", header: "الموظف" },
  { key: "employeeNo", header: "الرقم الوظيفي" },
  { key: "department", header: "القسم" },
  { key: "branch", header: "الفرع" },
  { key: "template", header: "النموذج" },
  { key: "evaluator", header: "المقيّم" },
  { key: "reviewer", header: "المراجع" },
  { key: "status", header: "الحالة" },
  { key: "score", header: "النتيجة" },
  { key: "submittedAt", header: "تاريخ الإرسال" },
  { key: "reviewedAt", header: "تاريخ المراجعة" },
];
