import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createBranchSchema,
  updateBranchSchema,
  type CreateBranchInput,
  type UpdateBranchInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { BranchesService } from "./branches.service";

@ApiTags("branches")
@Controller("branches")
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get()
  @Permissions("branches:view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @Permissions("branches:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("branches:create")
  create(
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("branches:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("branches:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
