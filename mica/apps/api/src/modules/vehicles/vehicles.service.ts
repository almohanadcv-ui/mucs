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
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : undefined,
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
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : undefined,
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

    return vehicle;
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
