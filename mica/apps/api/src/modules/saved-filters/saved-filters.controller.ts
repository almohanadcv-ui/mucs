import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createSavedFilterSchema, type CreateSavedFilterInput } from "@mica-mab/shared-types";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { SavedFiltersService } from "./saved-filters.service";

@ApiTags("saved-filters")
@Controller("saved-filters")
export class SavedFiltersController {
  constructor(private readonly service: SavedFiltersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("module") module: string) {
    return this.service.list(user.id, module);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createSavedFilterSchema)) body: CreateSavedFilterInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(user.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(user.id, id);
  }
}
