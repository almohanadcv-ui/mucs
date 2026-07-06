import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateTeamSchema,
  type AddTeamMemberInput,
  type CreateTeamInput,
  type UpdateTeamInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { TeamsService } from "./teams.service";

@ApiTags("teams")
@Controller("teams")
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  @Permissions("teams:view")
  list(@Query("departmentId") departmentId?: string) {
    return this.service.list(departmentId);
  }

  @Get(":id")
  @Permissions("teams:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("teams:create")
  create(
    @Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("teams:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTeamSchema)) body: UpdateTeamInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("teams:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/members")
  @Permissions("teams:update")
  addMember(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addTeamMemberSchema)) body: AddTeamMemberInput,
  ) {
    return this.service.addMember(id, body.userId);
  }

  @Delete(":id/members/:userId")
  @Permissions("teams:update")
  @HttpCode(204)
  removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    return this.service.removeMember(id, userId);
  }
}
