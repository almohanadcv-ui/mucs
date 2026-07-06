import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { PrismaService } from "@/database/prisma/prisma.service";
import { REDIS_CLIENT } from "@/redis/redis.constants";

const CACHE_KEY = "dashboard:kpis";
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getKpis(branchId?: string) {
    const cacheKey = branchId ? `${CACHE_KEY}:${branchId}` : CACHE_KEY;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const fresh = await this.computeKpis(branchId);
    await this.redis.set(cacheKey, JSON.stringify(fresh), "EX", CACHE_TTL_SECONDS);
    return fresh;
  }

  private async computeKpis(branchId?: string) {
    const branchFilter = branchId ? { branchId } : {};
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      vehiclesByStatus,
      maintenanceByStatus,
      invoicesByStatus,
      upcomingAppointments,
      overdueVehicleDocs,
      overdueDriverLicenses,
      oilChangeDueSoon,
      maintenanceDueSoon,
      monthlyCost,
      totalVehicles,
      totalDrivers,
    ] = await Promise.all([
      this.prisma.vehicle.groupBy({
        by: ["status"],
        where: { deletedAt: null, ...branchFilter },
        _count: true,
      }),
      this.prisma.maintenanceRequest.groupBy({
        by: ["status"],
        where: { deletedAt: null, ...branchFilter },
        _count: true,
      }),
      this.prisma.invoice.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.appointment.count({
        where: {
          deletedAt: null,
          ...branchFilter,
          startAt: { gte: now, lte: sevenDaysOut },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      }),
      this.prisma.vehicle.count({
        where: {
          deletedAt: null,
          ...branchFilter,
          OR: [
            { insuranceExpiry: { lt: now } },
            { registrationExpiry: { lt: now } },
            { licenseExpiry: { lt: now } },
          ],
        },
      }),
      this.prisma.driver.count({
        where: { deletedAt: null, ...branchFilter, licenseExpiryDate: { lt: now } },
      }),
      // Oil change due within the next 7 days (or already overdue).
      this.prisma.vehicle.count({
        where: {
          deletedAt: null,
          ...branchFilter,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          oilChangeDueAt: { not: null, lte: sevenDaysOut },
        },
      }),
      // Next maintenance due within the next 7 days (or already overdue).
      this.prisma.vehicle.count({
        where: {
          deletedAt: null,
          ...branchFilter,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          nextMaintenanceAt: { not: null, lte: sevenDaysOut },
        },
      }),
      this.prisma.maintenanceRequest.aggregate({
        where: {
          deletedAt: null,
          ...branchFilter,
          completedAt: { gte: startOfMonth },
        },
        _sum: { actualCost: true },
      }),
      this.prisma.vehicle.count({ where: { deletedAt: null, ...branchFilter } }),
      this.prisma.driver.count({ where: { deletedAt: null, ...branchFilter } }),
    ]);

    const invoiceCount = (status: string) =>
      invoicesByStatus.find((i) => i.status === status)?._count ?? 0;

    return {
      totalVehicles,
      totalDrivers,
      vehiclesByStatus: vehiclesByStatus.map((v) => ({ status: v.status, count: v._count })),
      maintenanceByStatus: maintenanceByStatus.map((m) => ({ status: m.status, count: m._count })),
      invoicesByStatus: invoicesByStatus.map((i) => ({ status: i.status, count: i._count })),
      pendingInvoices: invoiceCount("PENDING"),
      acceptedInvoices: invoiceCount("ACCEPTED"),
      rejectedInvoices: invoiceCount("REJECTED"),
      upcomingAppointments,
      overdueVehicleDocs,
      overdueDriverLicenses,
      oilChangeDueSoon,
      maintenanceDueSoon,
      monthlyMaintenanceCost: monthlyCost._sum.actualCost ?? 0,
    };
  }
}
