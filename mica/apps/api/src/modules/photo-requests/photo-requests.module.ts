import { Module } from "@nestjs/common";
import { MediaModule } from "@/modules/media/media.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { PhotoRequestsController } from "./photo-requests.controller";
import { PhotoRequestsService } from "./photo-requests.service";

@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [PhotoRequestsController],
  providers: [PhotoRequestsService],
})
export class PhotoRequestsModule {}
