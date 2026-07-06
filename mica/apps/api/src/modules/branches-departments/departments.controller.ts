import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { DepartmentsService } from "./departments.service";

@ApiTags("departments")
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  @Permissions("departments:view")
  list(@Query("branchId") branchId?: string) {
    return this.service.list(branchId);
  }

  @Get(":id")
  @Permissions("departments:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("departments:create")
  create(
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("departments:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("departments:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
