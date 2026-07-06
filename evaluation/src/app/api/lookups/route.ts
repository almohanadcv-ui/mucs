import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { prisma } from "@/infrastructure/db/prisma";
import { Role } from "@/core/domain/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal id/name lists for form selectors, scoped to the tenant. */
export const GET = withAuth(
  async ({ user }) => {
    const tenantId = user.tenantId;
    const [branches, departments, supervisors, evaluators, templates] =
      await prisma.$transaction([
        prisma.branch.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.department.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, branchId: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { tenantId, deletedAt: null, role: Role.SUPERVISOR },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { tenantId, deletedAt: null, role: Role.EVALUATOR },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.evaluationTemplate.findMany({
          where: { tenantId, deletedAt: null, isActive: true },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
      ]);
    return ok({ branches, departments, supervisors, evaluators, templates });
  },
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM, Permission.EVALUATION_CREATE] },
);
