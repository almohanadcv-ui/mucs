import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { AppointmentsService } from "./appointments.service";

@ApiTags("appointments")
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @Permissions("appointments:view")
  list(
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("branchId") branchId?: string,
    @Query("vehicleId") vehicleId?: string,
  ) {
    return this.service.list({ start, end, branchId, vehicleId });
  }

  @Get(":id")
  @Permissions("appointments:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("appointments:create")
  create(
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("appointments:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("appointments:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
