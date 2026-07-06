import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
  ) {
    return this.service.list(user.id, Number(page), Number(pageSize));
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.service.unreadCount(user.id).then((count) => ({ count }));
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.markRead(user.id, id);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.service.markAllRead(user.id);
  }
}
