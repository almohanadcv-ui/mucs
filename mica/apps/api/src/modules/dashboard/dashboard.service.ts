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

  /** Vehicles whose next maintenance or inspection is overdue or due within a
   *  week — surfaced as alert cards for technicians and managers. */
  async getMaintenanceAlerts(branchId?: string) {
    const branchFilter = branchId ? { branchId } : {};
    const nowTs = Date.now();
    const soon = new Date(nowTs + 7 * 24 * 60 * 60 * 1000);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
        ...branchFilter,
        OR: [
          { nextMaintenanceAt: { not: null, lte: soon } },
          { nextInspectionAt: { not: null, lte: soon } },
        ],
      },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        nextMaintenanceAt: true,
        nextInspectionAt: true,
        currentDriver: { select: { firstName: true, lastName: true } },
      },
      take: 50,
    });

    return vehicles
      .map((v) => {
        const earliest = Math.min(
          ...[v.nextMaintenanceAt, v.nextInspectionAt]
            .filter((d): d is Date => !!d)
            .map((d) => d.getTime()),
        );
        return {
          ...v,
          earliestDueAt: new Date(earliest).toISOString(),
          urgency: earliest < nowTs ? ("overdue" as const) : ("soon" as const),
        };
      })
      .sort((a, b) => a.earliestDueAt.localeCompare(b.earliestDueAt));
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
      monthlyInvoiceCost,
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
      // Management-facing spend: approved invoices this month only.
      this.prisma.invoice.aggregate({
        where: { deletedAt: null, status: "ACCEPTED", createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
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
      monthlyApprovedInvoiceCost: monthlyInvoiceCost._sum.amount ?? 0,
    };
  }
}
