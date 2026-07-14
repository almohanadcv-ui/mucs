import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createUserSchema,
  paginationQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type PaginationQuery,
  type UpdateUserInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions("users:view")
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.list(query, user.id);
  }

  @Get(":id")
  @Permissions("users:view")
  findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Permissions("users:invite")
  create(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("users:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.update(id, body, user.id);
  }

  @Post(":id/reset-password")
  @Permissions("users:update")
  resetPassword(@Param("id") id: string) {
    return this.usersService.createPasswordResetLink(id);
  }

  @Post(":id/suspend")
  @Permissions("users:suspend")
  @HttpCode(204)
  suspend(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.usersService.suspend(id, user.id);
  }

  @Delete(":id")
  @Permissions("users:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.usersService.remove(id, user.id);
  }
}
