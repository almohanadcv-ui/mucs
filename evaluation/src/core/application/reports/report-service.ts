import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { Role } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";

/** A translator (server `getT` result) so headers/status follow the locale. */
type TFn = (key: string, params?: Record<string, string | number>) => string;

export interface EvaluationReportRow {
  employeeName: string;
  employeeNo: string;
  department: string;
  branch: string;
  template: string;
  evaluator: string;
  reviewer: string;
  /** Localized status for display. */
  status: string;
  /** Raw enum value for stable filtering regardless of locale. */
  statusKey: string;
  score: number | null;
  submittedAt: string;
  reviewedAt: string;
}

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
  t: TFn,
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
    status: t(`evalStatus.${e.status}`),
    statusKey: e.status,
    score: e.score,
    submittedAt: e.submittedAt ? e.submittedAt.toISOString().slice(0, 10) : "",
    reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString().slice(0, 10) : "",
  }));
}

/** Localized report columns; `statusKey` is internal and never a column. */
export function reportColumns(
  t: TFn,
): { key: keyof EvaluationReportRow; header: string }[] {
  return [
    { key: "employeeName", header: t("reports.colEmployee") },
    { key: "employeeNo", header: t("reports.colEmployeeNo") },
    { key: "department", header: t("reports.colDepartment") },
    { key: "branch", header: t("reports.colBranch") },
    { key: "template", header: t("reports.colTemplate") },
    { key: "evaluator", header: t("reports.colEvaluator") },
    { key: "reviewer", header: t("reports.colReviewer") },
    { key: "status", header: t("reports.colStatus") },
    { key: "score", header: t("reports.colScore") },
    { key: "submittedAt", header: t("reports.colSubmitted") },
    { key: "reviewedAt", header: t("reports.colReviewed") },
  ];
}
