import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDriverReportInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { MaintenanceService } from "@/modules/maintenance/maintenance.service";
import { MediaService } from "@/modules/media/media.service";

/**
 * Every method here is anchored to the caller's own Driver record — this is
 * the ownership boundary the generic /maintenance, /vehicles and /media
 * endpoints don't enforce, so drivers must never be routed through those.
 */
@Injectable()
export class DriverPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenance: MaintenanceService,
    private readonly media: MediaService,
  ) {}

  private async getDriverOrThrow(userId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!driver) throw new ForbiddenException("No driver profile is linked to this account");
    return driver;
  }

  async listVehicles(userId: string) {
    const driver = await this.getDriverOrThrow(userId);
    return this.prisma.vehicle.findMany({
      where: { currentDriverId: driver.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async listReports(userId: string) {
    await this.getDriverOrThrow(userId);
    return this.prisma.maintenanceRequest.findMany({
      where: { reportedById: userId, source: "DRIVER_REPORT", deletedAt: null },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getReport(userId: string, reportId: string) {
    const report = await this.findOwnReport(userId, reportId);
    const [comments, attachments] = await Promise.all([
      this.maintenance.listComments(reportId),
      this.media.listByEntity("MAINTENANCE_REQUEST", reportId),
    ]);
    return { ...report, comments, attachments };
  }

  async createReport(userId: string, dto: CreateDriverReportInput) {
    const driver = await this.getDriverOrThrow(userId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, currentDriverId: driver.id, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) throw new ForbiddenException("This vehicle is not assigned to you");

    const driverName = `${driver.firstName} ${driver.lastName}`.trim();
    return this.maintenance.createDriverReport(dto, userId, driverName);
  }

  async uploadMedia(userId: string, reportId: string, file: Express.Multer.File) {
    await this.findOwnReport(userId, reportId);
    return this.media.upload("MAINTENANCE_REQUEST", reportId, file, userId);
  }

  /** 404 (not 403) on mismatch so a driver can't probe for other drivers' report ids. */
  private async findOwnReport(userId: string, reportId: string) {
    await this.getDriverOrThrow(userId);
    const report = await this.prisma.maintenanceRequest.findFirst({
      where: { id: reportId, reportedById: userId, source: "DRIVER_REPORT", deletedAt: null },
      include: { vehicle: true },
    });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }
}
