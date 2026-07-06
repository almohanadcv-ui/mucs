import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  maintenanceCostReportQuerySchema,
  type MaintenanceCostReportQuery,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("maintenance-cost")
  @Permissions("reports:view")
  maintenanceCost(
    @Query(new ZodValidationPipe(maintenanceCostReportQuerySchema)) query: MaintenanceCostReportQuery,
  ) {
    return this.service.maintenanceCostReport(query);
  }

  @Get("maintenance-cost/export")
  @Permissions("reports:export")
  async exportMaintenanceCost(
    @Query(new ZodValidationPipe(maintenanceCostReportQuerySchema)) query: MaintenanceCostReportQuery,
    @Query("format") format: "csv" | "excel" = "csv",
    @Res() res: Response,
  ) {
    const rows = await this.service.maintenanceCostReport(query);

    if (format === "excel") {
      const buffer = await this.service.toExcelBuffer(rows);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", 'attachment; filename="maintenance-cost-report.xlsx"');
      res.send(buffer);
      return;
    }

    const csv = this.service.toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="maintenance-cost-report.csv"');
    res.send(csv);
  }
}
