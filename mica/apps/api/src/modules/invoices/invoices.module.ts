import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { InvoicesController } from "./invoices.controller";
import { InvoiceActionsController } from "./invoice-actions.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceActionTokenService } from "./invoice-action-token.service";

@Module({
  imports: [NotificationsModule],
  controllers: [InvoicesController, InvoiceActionsController],
  providers: [InvoicesService, InvoiceActionTokenService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
