import { Module } from "@nestjs/common";
import { WorkflowModule } from "@/modules/workflow/workflow.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceService } from "./maintenance.service";
import { SparePartsController } from "./spare-parts.controller";
import { SparePartsService } from "./spare-parts.service";

@Module({
  imports: [WorkflowModule, NotificationsModule],
  controllers: [MaintenanceController, SparePartsController],
  providers: [MaintenanceService, SparePartsService],
  exports: [MaintenanceService, SparePartsService],
})
export class MaintenanceModule {}
