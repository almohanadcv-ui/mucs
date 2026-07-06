import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createRoleSchema,
  setRolePermissionsSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type SetRolePermissionsInput,
  type UpdateRoleInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { RolesPermissionsService } from "./roles-permissions.service";

@ApiTags("roles-permissions")
@Controller("roles-permissions")
export class RolesPermissionsController {
  constructor(private readonly service: RolesPermissionsService) {}

  @Get("permissions")
  @Permissions("roles:view")
  listPermissions() {
    return this.service.listPermissions();
  }

  @Get("roles")
  @Permissions("roles:view")
  listRoles() {
    return this.service.listRoles();
  }

  @Get("roles/:id")
  @Permissions("roles:view")
  findRole(@Param("id") id: string) {
    return this.service.findRole(id);
  }

  @Post("roles")
  @Permissions("roles:create")
  createRole(
    @Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createRole(body, user.id);
  }

  @Patch("roles/:id")
  @Permissions("roles:update")
  updateRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateRole(id, body, user.id);
  }

  @Delete("roles/:id")
  @Permissions("roles:delete")
  @HttpCode(204)
  deleteRole(@Param("id") id: string) {
    return this.service.deleteRole(id);
  }

  @Put("roles/:id/permissions")
  @Permissions("roles:assign")
  @HttpCode(204)
  setRolePermissions(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setRolePermissionsSchema)) body: SetRolePermissionsInput,
  ) {
    return this.service.setRolePermissions(id, body);
  }
}
