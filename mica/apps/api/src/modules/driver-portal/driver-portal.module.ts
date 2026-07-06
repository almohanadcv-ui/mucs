import { Module } from "@nestjs/common";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { MediaModule } from "@/modules/media/media.module";
import { DriverPortalController } from "./driver-portal.controller";
import { DriverPortalService } from "./driver-portal.service";

@Module({
  imports: [MaintenanceModule, MediaModule],
  controllers: [DriverPortalController],
  providers: [DriverPortalService],
})
export class DriverPortalModule {}
