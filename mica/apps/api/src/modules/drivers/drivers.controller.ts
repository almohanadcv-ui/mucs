import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createDriverSchema,
  paginationQuerySchema,
  updateDriverSchema,
  type CreateDriverInput,
  type PaginationQuery,
  type UpdateDriverInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { DriversService } from "./drivers.service";

@ApiTags("drivers")
@Controller("drivers")
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  @Permissions("drivers:view")
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
  ) {
    return this.service.list(query, { branchId, status });
  }

  @Get(":id")
  @Permissions("drivers:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("drivers:create")
  create(
    @Body(new ZodValidationPipe(createDriverSchema)) body: CreateDriverInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("drivers:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDriverSchema)) body: UpdateDriverInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("drivers:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
