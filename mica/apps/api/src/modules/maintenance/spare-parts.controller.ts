import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createSparePartSchema,
  updateSparePartSchema,
  type CreateSparePartInput,
  type UpdateSparePartInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { SparePartsService } from "./spare-parts.service";

@ApiTags("spare-parts")
@Controller("spare-parts")
export class SparePartsController {
  constructor(private readonly service: SparePartsService) {}

  @Get()
  @Permissions("spare-parts:view")
  list(@Query("branchId") branchId?: string) {
    return this.service.list(branchId);
  }

  @Get(":id")
  @Permissions("spare-parts:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("spare-parts:create")
  create(
    @Body(new ZodValidationPipe(createSparePartSchema)) body: CreateSparePartInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("spare-parts:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSparePartSchema)) body: UpdateSparePartInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("spare-parts:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
