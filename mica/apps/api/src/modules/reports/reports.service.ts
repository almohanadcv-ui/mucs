import { Injectable } from "@nestjs/common";
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

  async maintenanceCostReport(query: MaintenanceCostReportQuery): Promise<MaintenanceCostRow[]> {
    const where = {
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
