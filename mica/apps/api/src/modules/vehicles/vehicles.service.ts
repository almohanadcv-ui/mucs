import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateVehicleInput, PaginationQuery, UpdateVehicleInput } from "@mica-mab/shared-types";
import { NotificationChannel } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { WebhooksService } from "@/modules/webhooks/webhooks.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tell a driver (via their user account) that a vehicle is now theirs. */
  private async notifyDriverHandover(
    driverId: string | null | undefined,
    plateNumber: string,
  ): Promise<void> {
    if (!driverId) return;
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });
    if (!driver?.userId) return;
    await this.notifications.notify({
      recipientId: driver.userId,
      type: "vehicle.handover",
      title: "تم تسليم مركبة لك",
      body: `تم تسليم المركبة ${plateNumber} إليك.`,
      payload: { plateNumber },
      channels: [NotificationChannel.IN_APP],
    });
  }

  /**
   * Keep the calendar in sync with a vehicle's scheduled maintenance/inspection:
   * setting `nextMaintenanceAt` / `nextInspectionAt` creates (or reschedules) an
   * appointment linked to the vehicle, its current driver, and the technician.
   * Idempotent — reuses the vehicle's open appointment of that type.
   */
  private async syncScheduleAppointment(
    vehicle: {
      id: string;
      plateNumber: string;
      branchId: string;
      currentDriverId: string | null;
    },
    type: "MAINTENANCE" | "INSPECTION",
    dueAt: Date | null | undefined,
    actingUserId: string,
  ): Promise<void> {
    if (!dueAt) return;
    const start = dueAt;
    const end = new Date(dueAt.getTime() + 60 * 60 * 1000);
    const title =
      type === "MAINTENANCE"
        ? `صيانة دورية - ${vehicle.plateNumber}`
        : `فحص/تشييك - ${vehicle.plateNumber}`;

    const existing = await this.prisma.appointment.findFirst({
      where: {
        vehicleId: vehicle.id,
        type,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        deletedAt: null,
      },
    });

    if (existing) {
      await this.prisma.appointment.update({
        where: { id: existing.id },
        data: {
          startAt: start,
          endAt: end,
          driverId: vehicle.currentDriverId,
          assignedToId: actingUserId,
          updatedById: actingUserId,
        },
      });
      return;
    }

    await this.prisma.appointment.create({
      data: {
        title,
        type,
        vehicleId: vehicle.id,
        driverId: vehicle.currentDriverId,
        startAt: start,
        endAt: end,
        branchId: vehicle.branchId,
        assignedToId: actingUserId,
        status: "SCHEDULED",
        createdById: actingUserId,
      },
    });
  }

  async list(query: PaginationQuery, filters: { branchId?: string; status?: string }) {
    const where = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(query.search
        ? {
            OR: [
              { plateNumber: { contains: query.search, mode: "insensitive" as const } },
              { vin: { contains: query.search, mode: "insensitive" as const } },
              { make: { contains: query.search, mode: "insensitive" as const } },
              { model: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.sortDir },
        include: { branch: true, currentDriver: true },
      }),
      this.prisma.vehicle.count({ where }),
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
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: { branch: true, currentDriver: true },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return vehicle;
  }

  async findByQrValue(qrCodeValue: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { qrCodeValue, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return vehicle;
  }

  async create(dto: CreateVehicleInput, actingUserId: string) {
    await this.assertUnique(dto.plateNumber, dto.vin);
    const branchId = dto.branchId ?? (await this.defaultBranchId());

    // If a fuel level is set at intake, stamp who recorded it and when.
    let fuelMeta: { fuelUpdatedAt?: Date; fuelUpdatedByName?: string } = {};
    if (dto.fuelLevel) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actingUserId },
        select: { firstName: true, lastName: true, email: true },
      });
      const name = actor
        ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email
        : undefined;
      fuelMeta = { fuelUpdatedAt: new Date(), fuelUpdatedByName: name };
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        ...dto,
        ...fuelMeta,
        branchId,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        oilChangeDueAt: dto.oilChangeDueAt ? new Date(dto.oilChangeDueAt) : undefined,
        lastOilChangeAt: dto.lastOilChangeAt ? new Date(dto.lastOilChangeAt) : undefined,
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : undefined,
        nextInspectionAt: dto.nextInspectionAt ? new Date(dto.nextInspectionAt) : undefined,
        qrCodeValue: randomUUID(),
        createdById: actingUserId,
      },
    });

    await this.webhooks.trigger("vehicle.created", {
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      branchId: vehicle.branchId,
    });

    // If handed to a driver at intake, notify them right away.
    await this.notifyDriverHandover(vehicle.currentDriverId, vehicle.plateNumber);
    await this.syncScheduleAppointment(vehicle, "MAINTENANCE", vehicle.nextMaintenanceAt, actingUserId);
    await this.syncScheduleAppointment(vehicle, "INSPECTION", vehicle.nextInspectionAt, actingUserId);

    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleInput, actingUserId: string) {
    const before = await this.findById(id);
    // When the fuel level is (re)set, stamp who changed it and when.
    let fuelMeta: { fuelUpdatedAt?: Date; fuelUpdatedByName?: string } = {};
    if (dto.fuelLevel !== undefined) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actingUserId },
        select: { firstName: true, lastName: true, email: true },
      });
      const name = actor
        ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email
        : undefined;
      fuelMeta = { fuelUpdatedAt: new Date(), fuelUpdatedByName: name };
    }
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        ...fuelMeta,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        oilChangeDueAt: dto.oilChangeDueAt ? new Date(dto.oilChangeDueAt) : undefined,
        lastOilChangeAt: dto.lastOilChangeAt ? new Date(dto.lastOilChangeAt) : undefined,
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : undefined,
        nextInspectionAt: dto.nextInspectionAt ? new Date(dto.nextInspectionAt) : undefined,
        updatedById: actingUserId,
      },
    });

    // Notify the driver only when the vehicle is (re)assigned to a new one.
    if (
      dto.currentDriverId !== undefined &&
      dto.currentDriverId &&
      dto.currentDriverId !== before.currentDriverId
    ) {
      await this.notifyDriverHandover(dto.currentDriverId, vehicle.plateNumber);
    }

    // Reschedule calendar appointments when the due dates change.
    if (dto.nextMaintenanceAt !== undefined) {
      await this.syncScheduleAppointment(vehicle, "MAINTENANCE", vehicle.nextMaintenanceAt, actingUserId);
    }
    if (dto.nextInspectionAt !== undefined) {
      await this.syncScheduleAppointment(vehicle, "INSPECTION", vehicle.nextInspectionAt, actingUserId);
    }

    return vehicle;
  }

  /**
   * A merged, newest-first activity log for one vehicle: maintenance requests &
   * driver reports, calendar appointments, and audited field changes.
   */
  async timeline(id: string) {
    await this.findById(id);
    const [maintenance, appointments, audits] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: { vehicleId: id },
        orderBy: { createdAt: "desc" },
        include: { reportedBy: true },
      }),
      this.prisma.appointment.findMany({
        where: { vehicleId: id, deletedAt: null },
        orderBy: { startAt: "desc" },
        include: { assignedTo: true },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: "VEHICLE", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const userIds = [...new Set(audits.map((a) => a.userId).filter((v): v is string => !!v))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email]),
    );
    const fullName = (u: { firstName: string; lastName: string } | null) =>
      u ? `${u.firstName} ${u.lastName}`.trim() : null;

    const items = [
      ...maintenance.map((m) => ({
        at: m.createdAt,
        kind: "maintenance" as const,
        title:
          m.reportType === "VEHICLE_FAULT"
            ? "بلاغ عطل"
            : m.reportType === "PERIODIC_MAINTENANCE"
              ? "بلاغ صيانة دورية"
              : m.source === "DRIVER_REPORT"
                ? "بلاغ سائق"
                : "طلب صيانة",
        detail: `${m.requestNumber} · ${m.title}`,
        status: m.status as string,
        actor: fullName(m.reportedBy),
      })),
      ...appointments.map((a) => ({
        at: a.startAt,
        kind: a.type === "INSPECTION" ? ("inspection" as const) : ("appointment" as const),
        title:
          a.type === "INSPECTION"
            ? "موعد فحص/تشييك"
            : a.type === "MAINTENANCE"
              ? "موعد صيانة"
              : "موعد",
        detail: a.title,
        status: a.status as string,
        actor: fullName(a.assignedTo),
      })),
      ...audits.map((a) => ({
        at: a.createdAt,
        kind: "audit" as const,
        title: "تعديل على المركبة",
        detail: a.action,
        status: null as string | null,
        actor: a.userId ? (nameById.get(a.userId) ?? null) : null,
      })),
    ].sort((x, y) => y.at.getTime() - x.at.getTime());

    return items;
  }

  /** Single-workshop default: the primary (oldest) branch, so vehicle intake needn't pick one. */
  private async defaultBranchId(): Promise<string> {
    const branch = await this.prisma.branch.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!branch) throw new BadRequestException("No branch is configured to receive vehicles");
    return branch.id;
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  listDeleted() {
    return this.prisma.vehicle.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async restore(id: string, actingUserId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || !vehicle.deletedAt) throw new NotFoundException("Deleted vehicle not found");
    return this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: null, updatedById: actingUserId },
    });
  }

  private async assertUnique(plateNumber: string, vin: string): Promise<void> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { OR: [{ plateNumber }, { vin }] },
    });
    if (existing) {
      const field = existing.plateNumber === plateNumber ? "plate number" : "VIN";
      throw new ConflictException(`A vehicle with this ${field} already exists`);
    }
  }
}
