import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("kpis")
  getKpis(@Query("branchId") branchId?: string) {
    return this.service.getKpis(branchId);
  }

  @Get("alerts")
  getAlerts(@Query("branchId") branchId?: string) {
    return this.service.getMaintenanceAlerts(branchId);
  }
}
