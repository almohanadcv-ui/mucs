import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { WebhooksService } from "./webhooks.service";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  @Permissions("webhooks:view")
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions("webhooks:create")
  create(
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("webhooks:update")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(updateWebhookSchema)) body: UpdateWebhookInput) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  @Permissions("webhooks:delete")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }

  @Get(":id/deliveries")
  @Permissions("webhooks:view")
  listDeliveries(@Param("id") id: string) {
    return this.service.listDeliveries(id);
  }

  @Post(":id/test")
  @Permissions("webhooks:test")
  @HttpCode(202)
  async test(@Param("id") id: string): Promise<void> {
    await this.service.test(id);
  }
}
