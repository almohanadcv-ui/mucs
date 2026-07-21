import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  addCommentSchema,
  approvalDecisionSchema,
  consumeSparePartSchema,
  createMaintenanceRequestSchema,
  paginationQuerySchema,
  transitionRequestSchema,
  updateMaintenanceRequestSchema,
  type AddCommentInput,
  type ApprovalDecisionInput,
  type ConsumeSparePartInput,
  type CreateMaintenanceRequestInput,
  type PaginationQuery,
  type TransitionRequestInput,
  type UpdateMaintenanceRequestInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { MaintenanceService } from "./maintenance.service";
import { WorkflowService } from "@/modules/workflow/workflow.service";
import { SparePartsService } from "./spare-parts.service";

@ApiTags("maintenance")
@Controller("maintenance")
export class MaintenanceController {
  constructor(
    private readonly service: MaintenanceService,
    private readonly workflow: WorkflowService,
    private readonly spareParts: SparePartsService,
  ) {}

  @Get()
  @Permissions("maintenance:view")
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("vehicleId") vehicleId?: string,
  ) {
    return this.service.list(query, { branchId, status, vehicleId });
  }

  // Declared before :id so "deleted" isn't captured as an id param.
  @Get("deleted")
  @Permissions("maintenance:delete")
  listDeleted() {
    return this.service.listDeleted();
  }

  @Post(":id/restore")
  @Permissions("maintenance:delete")
  restore(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.restore(id, user.id);
  }

  @Get(":id")
  @Permissions("maintenance:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("maintenance:create")
  create(
    @Body(new ZodValidationPipe(createMaintenanceRequestSchema)) body: CreateMaintenanceRequestInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Patch(":id")
  @Permissions("maintenance:update")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMaintenanceRequestSchema)) body: UpdateMaintenanceRequestInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("maintenance:delete")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/transition")
  @Permissions("maintenance:transition")
  transition(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(transitionRequestSchema)) body: TransitionRequestInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflow.transition(id, body.toStatus, body.note, user.id);
  }

  @Get(":id/history")
  @Permissions("maintenance:view")
  history(@Param("id") id: string) {
    return this.workflow.listHistory(id);
  }

  @Get(":id/approvals")
  @Permissions("maintenance:view")
  approvals(@Param("id") id: string) {
    return this.workflow.listApprovals(id);
  }

  @Post(":id/approvals/:level/decide")
  @Permissions("maintenance:approve")
  decideApproval(
    @Param("id") id: string,
    @Param("level", ParseIntPipe) level: number,
    @Body(new ZodValidationPipe(approvalDecisionSchema)) body: ApprovalDecisionInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflow.decideApproval(id, level, body.decision, body.comment, user.id);
  }

  @Get(":id/spare-parts")
  @Permissions("maintenance:view")
  listSpareParts(@Param("id") id: string) {
    return this.spareParts.listUsage(id);
  }

  @Post(":id/spare-parts")
  @Permissions("maintenance:update")
  consumeSparePart(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(consumeSparePartSchema)) body: ConsumeSparePartInput,
  ) {
    return this.spareParts.consume(id, body.sparePartId, body.quantityUsed);
  }

  @Get(":id/comments")
  @Permissions("maintenance:view")
  listComments(@Param("id") id: string) {
    return this.service.listComments(id);
  }

  @Post(":id/comments")
  @Permissions("maintenance:comment")
  addComment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addCommentSchema)) body: AddCommentInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addComment(id, user.id, body.body);
  }
}
