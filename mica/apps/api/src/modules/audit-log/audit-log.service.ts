import { Injectable } from "@nestjs/common";
import type { PaginationQuery } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQuery, filters: AuditLogFilters) {
    const where = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Enrich with the actor's display name (AuditLog has no user relation).
    const userIds = [...new Set(items.map((i) => i.userId).filter((v): v is string => !!v))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email]),
    );

    // Resolve the vehicle + driver referenced by each event so the log reads in
    // plain language ("طلب تصوير — لكزس ES 2022 (أ ب ج ١٢٣٤)") instead of opaque
    // ids. The vehicle id lives either on a Vehicle entity row directly, or in
    // the captured response body (changesAfter.vehicleId) for related actions
    // like photo-requests / maintenance / invoices.
    const vehicleIds = new Set<string>();
    const driverIds = new Set<string>();
    for (const i of items) {
      const vid = this.vehicleIdOf(i);
      if (vid) vehicleIds.add(vid);
      const did = this.stringField(i.changesAfter, "driverId");
      if (did) driverIds.add(did);
    }

    const [vehicles, drivers] = await Promise.all([
      vehicleIds.size
        ? this.prisma.vehicle.findMany({
            where: { id: { in: [...vehicleIds] } },
            select: { id: true, plateNumber: true, make: true, model: true, year: true, name: true },
          })
        : Promise.resolve([]),
      driverIds.size
        ? this.prisma.driver.findMany({
            where: { id: { in: [...driverIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);
    const vehicleById = new Map(
      vehicles.map((v) => [
        v.id,
        {
          id: v.id,
          plateNumber: v.plateNumber,
          label:
            (v.name?.trim() || `${v.make} ${v.model} ${v.year}`.trim()) +
            (v.plateNumber ? ` (${v.plateNumber})` : ""),
        },
      ]),
    );
    const driverNameById = new Map(
      drivers.map((d) => [d.id, [d.firstName, d.lastName].filter(Boolean).join(" ")]),
    );

    const enriched = items.map((i) => {
      const userName = i.userId ? (nameById.get(i.userId) ?? null) : null;
      const vid = this.vehicleIdOf(i);
      const vehicle = vid ? (vehicleById.get(vid) ?? null) : null;
      const did = this.stringField(i.changesAfter, "driverId");
      const driverName = did ? (driverNameById.get(did) ?? null) : null;
      return {
        ...i,
        userName,
        vehicle,
        driverName,
        summary: this.summarize(i, userName, vehicle, driverName),
      };
    });

    return {
      items: enriched,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  /** Read a string property off a JSON column, safely. */
  private stringField(json: unknown, key: string): string | null {
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const v = (json as Record<string, unknown>)[key];
      if (typeof v === "string" && v) return v;
    }
    return null;
  }

  /** The vehicle id an event refers to: the entity itself, or its response body. */
  private vehicleIdOf(item: { entityType: string | null; entityId: string | null; changesAfter: unknown }): string | null {
    if (item.entityType === "Vehicles" && item.entityId) return item.entityId;
    return this.stringField(item.changesAfter, "vehicleId");
  }

  /** A one-line Arabic description of the event for the log's main column. */
  private summarize(
    item: { action: string; entityType: string | null; path: string | null },
    userName: string | null,
    vehicle: { label: string } | null,
    driverName: string | null,
  ): string {
    const who = userName ?? "مستخدم";
    const veh = vehicle ? ` — ${vehicle.label}` : "";
    const drv = driverName ? ` (السائق: ${driverName})` : "";
    switch (item.action) {
      case "photorequests.post":
        return `${who}: طلب تصوير${veh}${drv}`;
      case "vehicles.post":
        return `${who}: إضافة مركبة${veh}`;
      case "vehicles.patch":
        return `${who}: تعديل مركبة${veh}`;
      case "vehicles.delete":
        return `${who}: حذف مركبة${veh}`;
      case "invoices.post":
        return `${who}: إنشاء فاتورة${veh}`;
      case "maintenance.post":
        return `${who}: إنشاء صيانة${veh}`;
      case "maintenance.patch":
        return `${who}: تحديث صيانة${veh}`;
    }
    if (item.path?.includes("/auth/2fa")) return `${who}: تحقّق بخطوتين`;
    const verb = item.action.split(".").pop();
    const verbAr =
      verb === "post" ? "إنشاء" : verb === "patch" || verb === "put" ? "تعديل" : verb === "delete" ? "حذف" : verb;
    return `${who}: ${verbAr} ${item.entityType ?? ""}${veh}`.trim();
  }
}
