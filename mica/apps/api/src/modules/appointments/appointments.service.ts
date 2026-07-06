import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateAppointmentInput, UpdateAppointmentInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { start?: string; end?: string; branchId?: string; vehicleId?: string }) {
    return this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.start || filters.end
          ? {
              AND: [
                filters.end ? { startAt: { lt: new Date(filters.end) } } : {},
                filters.start ? { endAt: { gt: new Date(filters.start) } } : {},
              ],
            }
          : {}),
      },
      orderBy: { startAt: "asc" },
      include: {
        vehicle: true,
        driver: true,
        assignedTo: true,
        maintenanceRequest: true,
      },
    });
  }

  async findById(id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: { vehicle: true, driver: true, assignedTo: true, maintenanceRequest: true },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }

  async create(dto: CreateAppointmentInput, actingUserId: string) {
    const conflicts = await this.findConflicts(dto.vehicleId, dto.driverId, dto.startAt, dto.endAt);

    const appointment = await this.prisma.appointment.create({
      data: {
        title: dto.title,
        type: dto.type,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        maintenanceRequestId: dto.maintenanceRequestId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        allDay: dto.allDay,
        branchId: dto.branchId,
        assignedToId: dto.assignedToId ?? actingUserId,
        colorTag: dto.colorTag,
        createdById: actingUserId,
      },
      include: { vehicle: true, driver: true, assignedTo: true },
    });

    return { appointment, conflicts };
  }

  async update(id: string, dto: UpdateAppointmentInput, actingUserId: string) {
    const existing = await this.findById(id);

    const startAt = dto.startAt ?? existing.startAt.toISOString();
    const endAt = dto.endAt ?? existing.endAt.toISOString();
    const vehicleId = dto.vehicleId === undefined ? existing.vehicleId : dto.vehicleId;
    const driverId = dto.driverId === undefined ? existing.driverId : dto.driverId;

    const conflicts =
      dto.startAt || dto.endAt || dto.vehicleId !== undefined || dto.driverId !== undefined
        ? await this.findConflicts(vehicleId ?? undefined, driverId ?? undefined, startAt, endAt, id)
        : [];

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        updatedById: actingUserId,
      },
      include: { vehicle: true, driver: true, assignedTo: true },
    });

    return { appointment, conflicts };
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  /** Soft conflict check — overlapping bookings are surfaced to the caller, not blocked. */
  private async findConflicts(
    vehicleId: string | undefined,
    driverId: string | undefined,
    startAt: string,
    endAt: string,
    excludeId?: string,
  ) {
    if (!vehicleId && !driverId) return [];

    return this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [...(vehicleId ? [{ vehicleId }] : []), ...(driverId ? [{ driverId }] : [])],
        startAt: { lt: new Date(endAt) },
        endAt: { gt: new Date(startAt) },
      },
      select: { id: true, title: true, startAt: true, endAt: true, vehicleId: true, driverId: true },
    });
  }
}
