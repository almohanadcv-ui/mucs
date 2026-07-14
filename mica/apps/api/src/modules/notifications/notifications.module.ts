import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsGateway } from "./notifications.gateway";
import { InAppChannelAdapter } from "./adapters/in-app-channel.adapter";
import { EmailChannelAdapter } from "./adapters/email-channel.adapter";
import { SmsChannelAdapter } from "./adapters/sms-channel.adapter";
import { WhatsAppChannelAdapter } from "./adapters/whatsapp-channel.adapter";
import { PushChannelAdapter } from "./adapters/push-channel.adapter";

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    InAppChannelAdapter,
    EmailChannelAdapter,
    SmsChannelAdapter,
    WhatsAppChannelAdapter,
    PushChannelAdapter,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
