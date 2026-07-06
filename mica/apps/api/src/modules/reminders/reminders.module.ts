import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [NotificationsModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
