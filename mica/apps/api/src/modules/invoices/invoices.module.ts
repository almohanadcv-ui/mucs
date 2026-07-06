import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
