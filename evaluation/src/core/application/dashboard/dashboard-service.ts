import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { EvaluationStatus, Role } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

/** Evaluation visibility scope by role (mirrors evaluation-service). */
function evalScope(user: SessionUser): Prisma.EvaluationWhereInput {
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

/** Employee visibility scope by role (mirrors employee-service). */
function employeeScope(user: SessionUser): Prisma.EmployeeWhereInput {
  switch (user.role) {
    case Role.ADMIN:
      return {};
    case Role.SUPERVISOR:
      return { supervisorId: user.id };
    case Role.EVALUATOR:
      // Mirrors employee-service: linked employees + those whose imported
      // «المدير المباشر» matches this evaluator's name.
      return {
        OR: [
          { evaluatorId: user.id },
          { directManager: { equals: user.name, mode: "insensitive" } },
        ],
      };
    default:
      return { id: "__none__" };
  }
}

export interface DashboardStats {
  role: Role;
  counts: {
    employees: number;
    evaluators: number;
    supervisors: number;
    evaluationsTotal: number;
    today: number;
    week: number;
    month: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  averageScore: number | null;
  ratingDistribution: { label: string; key: string; count: number }[];
  monthlyTrend: { month: string; average: number | null; count: number }[];
  topEmployees: { id: string; name: string; average: number; count: number }[];
}

/** Bucket a 0..100 score into the 5 Arabic rating bands. */
const BANDS = [
  { key: "excellent", label: "ممتاز", min: 90 },
  { key: "veryGood", label: "جيد جداً", min: 75 },
  { key: "good", label: "جيد", min: 60 },
  { key: "needsWork", label: "يحتاج تحسين", min: 40 },
  { key: "weak", label: "ضعيف", min: 0 },
] as const;

function bandFor(score: number) {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export async function getDashboardStats(
  user: SessionUser,
): Promise<DashboardStats> {
  const tenantId = user.tenantId;
  const base: Prisma.EvaluationWhereInput = {
    tenantId,
    deletedAt: null,
    ...evalScope(user),
  };

  const [
    employees,
    evaluators,
    supervisors,
    evaluationsTotal,
    today,
    week,
    month,
    pending,
    approved,
    rejected,
    approvedRows,
  ] = await prisma.$transaction([
    prisma.employee.count({
      where: { tenantId, deletedAt: null, ...employeeScope(user) },
    }),
    prisma.user.count({ where: { tenantId, deletedAt: null, role: Role.EVALUATOR } }),
    prisma.user.count({ where: { tenantId, deletedAt: null, role: Role.SUPERVISOR } }),
    prisma.evaluation.count({ where: base }),
    prisma.evaluation.count({ where: { ...base, submittedAt: { gte: startOfDay() } } }),
    prisma.evaluation.count({ where: { ...base, submittedAt: { gte: startOfWeek() } } }),
    prisma.evaluation.count({ where: { ...base, submittedAt: { gte: startOfMonth() } } }),
    prisma.evaluation.count({ where: { ...base, status: EvaluationStatus.PENDING } }),
    prisma.evaluation.count({ where: { ...base, status: EvaluationStatus.APPROVED } }),
    prisma.evaluation.count({ where: { ...base, status: EvaluationStatus.REJECTED } }),
    prisma.evaluation.findMany({
      where: { ...base, status: EvaluationStatus.APPROVED, score: { not: null } },
      select: { score: true, employeeId: true, reviewedAt: true, employee: { select: { name: true } } },
    }),
  ]);

  // Average score
  const scores = approvedRows.map((r) => r.score!).filter((s) => s != null);
  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  // Rating distribution
  const distCounts: Record<string, number> = {};
  for (const b of BANDS) distCounts[b.key] = 0;
  for (const s of scores) distCounts[bandFor(s).key] += 1;
  const ratingDistribution = BANDS.map((b) => ({
    key: b.key,
    label: b.label,
    count: distCounts[b.key],
  }));

  // Monthly trend (last 6 months)
  const now = new Date();
  const monthlyTrend: DashboardStats["monthlyTrend"] = [];
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const rows = approvedRows.filter(
      (r) => r.reviewedAt && r.reviewedAt >= from && r.reviewedAt < to,
    );
    const avg =
      rows.length > 0
        ? Math.round((rows.reduce((a, r) => a + r.score!, 0) / rows.length) * 10) / 10
        : null;
    monthlyTrend.push({ month: monthNames[from.getMonth()], average: avg, count: rows.length });
  }

  // Top employees by average approved score
  const byEmployee = new Map<string, { name: string; sum: number; count: number }>();
  for (const r of approvedRows) {
    const e = byEmployee.get(r.employeeId) ?? { name: r.employee.name, sum: 0, count: 0 };
    e.sum += r.score!;
    e.count += 1;
    byEmployee.set(r.employeeId, e);
  }
  const topEmployees = [...byEmployee.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      average: Math.round((v.sum / v.count) * 10) / 10,
      count: v.count,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  return {
    role: user.role,
    counts: {
      employees,
      evaluators,
      supervisors,
      evaluationsTotal,
      today,
      week,
      month,
      pending,
      approved,
      rejected,
    },
    averageScore,
    ratingDistribution,
    monthlyTrend,
    topEmployees,
  };
}
