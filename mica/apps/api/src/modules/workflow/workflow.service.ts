import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MaintenanceStatus, ApprovalStatus, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import { SettingsService } from "@/modules/settings/settings.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { WebhooksService } from "@/modules/webhooks/webhooks.service";
import { findTransitionRule, getAllowedTransitions } from "./transitions";

const APPROVAL_TIERS_SETTING_KEY = "maintenance.approvalTiers";

interface ApprovalTier {
  threshold: number;
  levels: number;
}

const DEFAULT_APPROVAL_TIERS: ApprovalTier[] = [
  { threshold: 0, levels: 1 },
  { threshold: 5000, levels: 2 },
  { threshold: 20000, levels: 3 },
];

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async transition(
    requestId: string,
    toStatus: MaintenanceStatus,
    note: string | undefined,
    actingUserId: string,
  ) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (!request) throw new NotFoundException("Maintenance request not found");

    const rule = findTransitionRule(request.status, toStatus);
    if (!rule) {
      const allowed = getAllowedTransitions(request.status).map((r) => r.to);
      throw new BadRequestException(
        allowed.length > 0
          ? `Cannot move from ${request.status} to ${toStatus}. Allowed next states: ${allowed.join(", ")}`
          : `Cannot move from ${request.status} to ${toStatus}. ${request.status} is a terminal state.`,
      );
    }

    const hasPermission = await this.permissionCache.hasPermission(actingUserId, rule.permission);
    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${rule.permission}`);
    }

    // Driver-report tickets have no mechanic assigned yet while REPORTED —
    // whoever starts the work becomes the assignee.
    const assignOnTransition =
      request.status === "REPORTED" && !request.assignedToId ? actingUserId : undefined;

    const updated = await this.applyTransition(
      request.id,
      request.status,
      toStatus,
      note,
      actingUserId,
      assignOnTransition,
    );

    if (request.source === "DRIVER_REPORT") {
      await this.notifyDriverOfStatusChange(updated.id, updated.requestNumber, request.reportedById, toStatus);
    }

    if (toStatus === "PENDING_APPROVAL") {
      await this.createApprovalsForRequest(request.id, request.estimatedCost);
      await this.notifyApprovers(updated.id, updated.requestNumber, updated.title);
    }

    if (toStatus === "ASSIGNED" && updated.assignedToId) {
      await this.notifications.notify({
        recipientId: updated.assignedToId,
        type: "maintenance.assigned",
        title: `You've been assigned ${updated.requestNumber}`,
        body: `"${updated.title}" was assigned to you.`,
        payload: { maintenanceRequestId: updated.id },
        channels: ["IN_APP", "EMAIL"],
      });
      await this.webhooks.trigger("maintenance.assigned", {
        maintenanceRequestId: updated.id,
        requestNumber: updated.requestNumber,
        assignedToId: updated.assignedToId,
      });
    }

    await this.webhooks.trigger("maintenance.transitioned", {
      maintenanceRequestId: updated.id,
      requestNumber: updated.requestNumber,
      fromStatus: request.status,
      toStatus,
    });

    return updated;
  }

  async listHistory(requestId: string) {
    return this.prisma.maintenanceStatusHistory.findMany({
      where: { maintenanceRequestId: requestId },
      orderBy: { changedAt: "asc" },
    });
  }

  async listApprovals(requestId: string) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, deletedAt: null },
      select: { id: true, status: true, estimatedCost: true },
    });
    if (!request) throw new NotFoundException("Maintenance request not found");

    const approvals = await this.prisma.maintenanceApproval.findMany({
      where: { maintenanceRequestId: requestId },
      orderBy: { level: "asc" },
    });
    if (approvals.length > 0 || request.status !== "PENDING_APPROVAL") return approvals;

    await this.createApprovalsForRequest(request.id, request.estimatedCost);
    return this.prisma.maintenanceApproval.findMany({
      where: { maintenanceRequestId: requestId },
      orderBy: { level: "asc" },
    });
  }

  async decideApproval(
    requestId: string,
    level: number,
    decision: "APPROVED" | "REJECTED",
    comment: string | undefined,
    actingUserId: string,
  ) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (!request) throw new NotFoundException("Maintenance request not found");
    if (request.status !== "PENDING_APPROVAL") {
      throw new BadRequestException("Request is not awaiting approval");
    }

    const approval = await this.prisma.maintenanceApproval.findFirst({
      where: { maintenanceRequestId: requestId, level },
    });
    if (!approval) throw new NotFoundException(`Approval level ${level} not found`);
    if (approval.status !== "PENDING") {
      throw new BadRequestException(`Approval level ${level} has already been decided`);
    }

    const earlierPending = await this.prisma.maintenanceApproval.findFirst({
      where: { maintenanceRequestId: requestId, level: { lt: level }, status: "PENDING" },
    });
    if (earlierPending) {
      throw new BadRequestException(
        `Level ${earlierPending.level} must be decided before level ${level}`,
      );
    }

    await this.prisma.maintenanceApproval.update({
      where: { id: approval.id },
      data: {
        status: decision as ApprovalStatus,
        decidedAt: new Date(),
        comment,
        approverUserId: actingUserId,
      },
    });

    if (decision === "REJECTED") {
      await this.applyTransition(
        requestId,
        "PENDING_APPROVAL",
        "REJECTED",
        `Rejected at approval level ${level}${comment ? `: ${comment}` : ""}`,
        actingUserId,
      );
      await this.updateLinkedAppointment(requestId, "CANCELLED");
      await this.notifyReporter(request, "rejected", comment);
      return { requestStatus: "REJECTED" as MaintenanceStatus };
    }

    const remainingPending = await this.prisma.maintenanceApproval.findFirst({
      where: { maintenanceRequestId: requestId, status: "PENDING" },
    });
    if (!remainingPending) {
      await this.applyTransition(
        requestId,
        "PENDING_APPROVAL",
        "APPROVED",
        "All approval levels satisfied",
        actingUserId,
      );
      await this.updateLinkedAppointment(requestId, "CONFIRMED");
      await this.notifyReporter(request, "approved");
      return { requestStatus: "APPROVED" as MaintenanceStatus };
    }

    return { requestStatus: "PENDING_APPROVAL" as MaintenanceStatus };
  }

  private async notifyApprovers(
    requestId: string,
    requestNumber: string,
    title: string,
  ): Promise<void> {
    const approverIds = await this.permissionCache.findUserIdsWithPermission("maintenance:approve");
    await Promise.all(
      approverIds.map((recipientId) =>
        this.notifications.notify({
          recipientId,
          type: "maintenance.approval_required",
          title: `Approval needed: ${requestNumber}`,
          body: `"${title}" is awaiting your approval.`,
          payload: { maintenanceRequestId: requestId },
          channels: ["IN_APP", "EMAIL"],
        }),
      ),
    );
  }

  private async notifyReporter(
    request: { id: string; requestNumber: string; title: string; reportedById: string },
    outcome: "approved" | "rejected",
    comment?: string,
  ): Promise<void> {
    await this.notifications.notify({
      recipientId: request.reportedById,
      type: `maintenance.${outcome}`,
      title: `${request.requestNumber} was ${outcome}`,
      body: comment ? `"${request.title}": ${comment}` : `"${request.title}" was ${outcome}.`,
      payload: { maintenanceRequestId: request.id },
      channels: ["IN_APP", "EMAIL"],
    });
  }

  private static readonly ARABIC_STATUS_LABELS: Partial<Record<MaintenanceStatus, string>> = {
    IN_PROGRESS: "قيد التنفيذ",
    WAITING_PARTS: "بانتظار القطع",
    QUALITY_INSPECTION: "فحص الجودة",
    COMPLETED: "مكتمل",
    DELIVERED: "تم التسليم",
    CANCELLED: "ملغى",
  };

  private async notifyDriverOfStatusChange(
    requestId: string,
    requestNumber: string,
    reportedById: string,
    toStatus: MaintenanceStatus,
  ): Promise<void> {
    const label = WorkflowService.ARABIC_STATUS_LABELS[toStatus] ?? toStatus;
    await this.notifications.notify({
      recipientId: reportedById,
      type: "maintenance.driver_report_status_changed",
      title: `تحديث حالة البلاغ ${requestNumber}`,
      body: `أصبحت حالة بلاغك الآن: ${label}.`,
      payload: { maintenanceRequestId: requestId },
      channels: ["IN_APP"],
    });
  }

  async startApprovalForRequest(
    requestId: string,
    requestNumber: string,
    title: string,
    estimatedCost: Prisma.Decimal | null,
  ): Promise<void> {
    await this.createApprovalsForRequest(requestId, estimatedCost);
    await this.notifyApprovers(requestId, requestNumber, title);
  }

  private async createApprovalsForRequest(
    requestId: string,
    estimatedCost: Prisma.Decimal | null,
  ): Promise<void> {
    const tiers = await this.settings.get<ApprovalTier[]>(
      APPROVAL_TIERS_SETTING_KEY,
      DEFAULT_APPROVAL_TIERS,
    );
    const cost = estimatedCost ? Number(estimatedCost) : 0;
    const levels =
      [...tiers]
        .sort((a, b) => a.threshold - b.threshold)
        .filter((tier) => cost >= tier.threshold)
        .at(-1)?.levels ?? 1;

    // Resubmission after a REJECTED -> DRAFT -> PENDING_APPROVAL cycle should
    // start the approval chain fresh rather than reusing decided rows.
    await this.prisma.maintenanceApproval.deleteMany({ where: { maintenanceRequestId: requestId } });
    await this.prisma.maintenanceApproval.createMany({
      data: Array.from({ length: levels }, (_, i) => ({
        maintenanceRequestId: requestId,
        level: i + 1,
        status: "PENDING" as ApprovalStatus,
      })),
    });
  }

  private async updateLinkedAppointment(
    requestId: string,
    status: "CONFIRMED" | "CANCELLED",
  ): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: { maintenanceRequestId: requestId, deletedAt: null },
      data: { status },
    });
  }

  private async applyTransition(
    requestId: string,
    fromStatus: MaintenanceStatus,
    toStatus: MaintenanceStatus,
    note: string | undefined,
    actingUserId: string,
    assignToId?: string,
  ) {
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: toStatus,
        updatedById: actingUserId,
        assignedToId: assignToId,
        completedAt: toStatus === "COMPLETED" ? new Date() : undefined,
      },
    });

    await this.prisma.maintenanceStatusHistory.create({
      data: {
        maintenanceRequestId: requestId,
        fromStatus,
        toStatus,
        changedById: actingUserId,
        note,
      },
    });

    return updated;
  }
}
