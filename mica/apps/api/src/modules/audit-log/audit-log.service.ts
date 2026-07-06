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
}
