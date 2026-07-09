import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { RemindersService } from "./reminders.service";

@ApiTags("reminders")
@Controller("reminders")
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  /** Manually run the full reminder sweep — due-date + appointment reminders
   *  (also runs daily on a cron). */
  @Post("run")
  @Permissions("vehicles:update")
  @HttpCode(200)
  run() {
    return this.service.runDailyReminders();
  }
}
