import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { paginationQuerySchema, type PaginationQuery } from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { AuditLogService } from "./audit-log.service";

@ApiTags("audit-log")
@Controller("audit-log")
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @Permissions("audit-log:view")
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(query, { entityType, entityId, userId, from, to });
  }
}
