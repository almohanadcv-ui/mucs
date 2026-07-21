import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import type { MaintenanceCostReportQuery } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

export interface MaintenanceCostRow {
  groupId: string;
  groupLabel: string;
  requestCount: number;
  totalEstimatedCost: number;
  totalActualCost: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The filter behind every row of the report. Deletion reuses it verbatim so
   * that removing a row removes exactly the requests that row counted — never
   * the ones a date filter had excluded from view.
   */
  private buildWhere(query: MaintenanceCostReportQuery) {
    return {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  async maintenanceCostReport(query: MaintenanceCostReportQuery): Promise<MaintenanceCostRow[]> {
    const where = this.buildWhere(query);

    const groupField = query.groupBy === "branch" ? "branchId" : "vehicleId";
    const grouped = await this.prisma.maintenanceRequest.groupBy({
      by: [groupField],
      where,
      _count: true,
      _sum: { estimatedCost: true, actualCost: true },
    });

    const ids = grouped.map((g) => g[groupField]);
    const labels =
      query.groupBy === "branch"
        ? await this.prisma.branch.findMany({ where: { id: { in: ids } } })
        : await this.prisma.vehicle.findMany({ where: { id: { in: ids } } });

    const labelMap = new Map(
      labels.map((l) => [
        l.id,
        query.groupBy === "branch"
          ? (l as { name: string }).name
          : `${(l as { plateNumber: string }).plateNumber}`,
      ]),
    );

    return grouped
      .map((g) => ({
        groupId: g[groupField],
        groupLabel: labelMap.get(g[groupField]) ?? g[groupField],
        requestCount: g._count,
        totalEstimatedCost: Number(g._sum.estimatedCost ?? 0),
        totalActualCost: Number(g._sum.actualCost ?? 0),
      }))
      .sort((a, b) => b.totalActualCost - a.totalActualCost);
  }

  /**
   * Soft-deletes every maintenance request behind one row of the cost report.
   *
   * A report row is an aggregate, not a record, so "deleting a row" can only
   * mean deleting what it sums. That is a bulk destructive action, so it is
   * deliberately narrow: it deletes only what the caller's current filters
   * already scoped, and the deletion is soft — every request lands in Trash and
   * can be restored individually.
   *
   * The Mechanic never reaches here (no reports:view), but the state rule is
   * enforced anyway rather than assumed, so the endpoint stays honest if the
   * role bundles change later.
   */
  async deleteGroup(
    query: MaintenanceCostReportQuery,
    groupId: string,
    actingUserId: string,
  ): Promise<{ deleted: number; skipped: number }> {
    const groupField = query.groupBy === "branch" ? "branchId" : "vehicleId";
    const scope: Prisma.MaintenanceRequestWhereInput = {
      ...this.buildWhere(query),
      [groupField]: groupId,
    };

    const isPrivileged =
      (await this.prisma.userRole.count({
        where: {
          userId: actingUserId,
          role: { name: { in: ["Technical Support", "Management"] } },
        },
      })) > 0;

    const total = await this.prisma.maintenanceRequest.count({ where: scope });
    const deletable: Prisma.MaintenanceRequestWhereInput = isPrivileged
      ? scope
      : { ...scope, status: { in: ["DRAFT", "PENDING_APPROVAL"] } };

    const { count } = await this.prisma.maintenanceRequest.updateMany({
      where: deletable,
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });

    return { deleted: count, skipped: total - count };
  }

  toCsv(rows: MaintenanceCostRow[]): string {
    const header = "Group,Requests,Estimated Cost,Actual Cost";
    const lines = rows.map(
      (r) =>
        `"${r.groupLabel.replace(/"/g, '""')}",${r.requestCount},${r.totalEstimatedCost},${r.totalActualCost}`,
    );
    return [header, ...lines].join("\n");
  }

  async toExcelBuffer(rows: MaintenanceCostRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Maintenance Cost");
    sheet.columns = [
      { header: "Group", key: "groupLabel", width: 30 },
      { header: "Requests", key: "requestCount", width: 12 },
      { header: "Estimated Cost", key: "totalEstimatedCost", width: 18 },
      { header: "Actual Cost", key: "totalActualCost", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
