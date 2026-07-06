import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createVehicleSchema,
  paginationQuerySchema,
  updateVehicleSchema,
  type CreateVehicleInput,
  type PaginationQuery,
  type UpdateVehicleInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @Permissions("vehicles:view")
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
  ) {
    return this.service.list(query, { branchId, status });
  }

  @Get("qr/:value")
  @Permissions("vehicles:view")
  findByQr(@Param("value") value: string) {
    return this.service.findByQrValue(value);
  }

  // Declared before :id so "deleted" isn't captured as an id param.
  @Get("deleted")
  @Permissions("vehicles:delete")
  listDeleted() {
    return this.service.listDeleted();
  }

  @Post(":id/restore")
  @Permissions("vehicles:delete")
  restore(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.restore(id, user.id);
  }

  @Get(":id")
  @Permissions("vehicles:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("vehicles:create")
  create(
    @Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("vehicles:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) body: UpdateVehicleInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("vehicles:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }
}
