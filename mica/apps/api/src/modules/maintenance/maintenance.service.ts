import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, NotificationChannel } from "@prisma/client";
import type {
  CreateDriverReportInput,
  CreateMaintenanceRequestInput,
  PaginationQuery,
  UpdateMaintenanceRequestInput,
} from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { WorkflowService } from "@/modules/workflow/workflow.service";

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly workflow: WorkflowService,
  ) {}

  async list(query: PaginationQuery, filters: { branchId?: string; status?: string; vehicleId?: string }) {
    const where = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(query.search
        ? {
            OR: [
              { requestNumber: { contains: query.search, mode: "insensitive" as const } },
              { title: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.sortDir },
        include: { vehicle: true, reportedBy: true, assignedTo: true, branch: true },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findById(id: string) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        vehicle: true,
        reportedBy: true,
        assignedTo: true,
        branch: true,
        spareParts: { include: { sparePart: true } },
      },
    });
    if (!request) throw new NotFoundException("Maintenance request not found");
    return request;
  }

  async create(dto: CreateMaintenanceRequestInput, actingUserId: string) {
    const requestNumber = await this.generateRequestNumber();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
      select: { id: true, plateNumber: true, make: true, model: true, name: true, branchId: true },
    });
    if (!vehicle) throw new BadRequestException("Vehicle is required");

    const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
    const title = dto.title || `Maintenance request ${vehicle.plateNumber}`;

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRequest.create({
        data: {
          requestNumber,
          vehicleId: vehicle.id,
          branchId: dto.branchId || vehicle.branchId,
          title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          estimatedCost: dto.estimatedCost,
          odometerAtRequest: dto.odometerAtRequest,
          scheduledDate: scheduledDate ?? undefined,
          reportedById: actingUserId,
          createdById: actingUserId,
          status: "PENDING_APPROVAL",
        },
        include: { vehicle: true, reportedBy: true, assignedTo: true, branch: true },
      });

      if (scheduledDate) {
        await tx.appointment.create({
          data: {
            title: `Maintenance - ${vehicle.plateNumber}`,
            type: "MAINTENANCE",
            vehicleId: vehicle.id,
            maintenanceRequestId: created.id,
            startAt: scheduledDate,
            endAt: new Date(scheduledDate.getTime() + 60 * 60 * 1000),
            branchId: created.branchId,
            assignedToId: actingUserId,
            colorTag: "#ef4444",
            createdById: actingUserId,
          },
        });
      }

      return created;
    });

    await this.workflow.startApprovalForRequest(
      request.id,
      request.requestNumber,
      request.title,
      request.estimatedCost,
    );
    await this.notifyManagers(request.id, request.requestNumber, vehicle.plateNumber);
    return request;
  }

  /**
   * Driver-submitted issue reports skip the cost-tier approval chain
   * entirely (they land straight in the mechanic's inbox as REPORTED) —
   * unlike create(), which always routes through workflow.startApprovalForRequest.
   */
  async createDriverReport(dto: CreateDriverReportInput, driverUserId: string, driverName: string) {
    const requestNumber = await this.generateRequestNumber();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
      select: { id: true, plateNumber: true, branchId: true },
    });
    if (!vehicle) throw new BadRequestException("Vehicle is required");

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        requestNumber,
        vehicleId: vehicle.id,
        branchId: vehicle.branchId,
        title: `بلاغ سائق - ${vehicle.plateNumber}`,
        description: dto.description,
        priority: "MEDIUM",
        source: "DRIVER_REPORT",
        reportType: dto.reportType,
        status: "REPORTED",
        reportedById: driverUserId,
        createdById: driverUserId,
      },
      include: { vehicle: true, reportedBy: true, assignedTo: true, branch: true },
    });

    await this.notifyMechanics(request.id, request.requestNumber, vehicle.plateNumber, driverName);
    await this.notifications.notify({
      recipientId: driverUserId,
      type: "maintenance.report_received",
      title: "تم استلام بلاغك",
      body: `تم استلام بلاغك رقم ${request.requestNumber} وسيتم مراجعته من قبل الفني قريبًا.`,
      payload: { maintenanceRequestId: request.id },
      channels: [NotificationChannel.IN_APP],
    });

    return request;
  }

  async addComment(requestId: string, authorId: string, body: string) {
    await this.findById(requestId);
    return this.prisma.comment.create({
      data: { entityType: EntityType.MAINTENANCE_REQUEST, entityId: requestId, authorId, body },
    });
  }

  async listComments(requestId: string) {
    return this.prisma.comment.findMany({
      where: { entityType: EntityType.MAINTENANCE_REQUEST, entityId: requestId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  async update(id: string, dto: UpdateMaintenanceRequestInput, actingUserId: string) {
    await this.findById(id);
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...dto,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        updatedById: actingUserId,
      },
    });
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    const request = await this.findById(id);

    // Technical Support may delete a request in any state; everyone else (the
    // Mechanic) only while it's still a Draft or awaiting approval — once
    // approved/in-progress it can be edited but not deleted.
    const isSuperAdmin =
      (await this.prisma.userRole.count({
        where: { userId: actingUserId, role: { name: "Technical Support" } },
      })) > 0;
    const deletableByMechanic = ["DRAFT", "PENDING_APPROVAL"];
    if (!isSuperAdmin && !deletableByMechanic.includes(request.status)) {
      throw new ForbiddenException(
        "لا يمكن حذف الطلب بعد اعتماده أو بدء تنفيذه — يمكنك تعديله فقط",
      );
    }

    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  private async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const count = await this.prisma.maintenanceRequest.count({
      where: { createdAt: { gte: yearStart } },
    });
    return `MR-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  private async notifyManagers(requestId: string, requestNumber: string, plateNumber: string) {
    const managers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        roles: { some: { role: { name: "Management" } } },
      },
      select: { id: true },
    });

    await Promise.all(
      managers.map((manager) =>
        this.notifications.notify({
          recipientId: manager.id,
          type: "maintenance.approval_requested",
          title: "طلب صيانة جديد بانتظار الاعتماد",
          body: `طلب ${requestNumber} للمركبة ${plateNumber} يحتاج مراجعة المدير.`,
          payload: { requestId },
          channels: [NotificationChannel.IN_APP],
        }),
      ),
    );
  }

  private async notifyMechanics(
    requestId: string,
    requestNumber: string,
    plateNumber: string,
    driverName: string,
  ) {
    const mechanics = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        roles: { some: { role: { permissions: { some: { permission: { key: "maintenance:transition" } } } } } },
      },
      select: { id: true },
    });

    await Promise.all(
      mechanics.map((mechanic) =>
        this.notifications.notify({
          recipientId: mechanic.id,
          type: "maintenance.driver_report_received",
          title: "بلاغ جديد من سائق",
          body: `${driverName} أرسل بلاغًا (${requestNumber}) عن المركبة ${plateNumber}.`,
          payload: { maintenanceRequestId: requestId },
          channels: [NotificationChannel.IN_APP],
        }),
      ),
    );
  }
}
