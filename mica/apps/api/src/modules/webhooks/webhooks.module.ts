import { Global, Module } from "@nestjs/common";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Global()
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
