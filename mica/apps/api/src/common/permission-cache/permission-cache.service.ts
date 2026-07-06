import { Inject, Injectable } from "@nestjs/common";
import { PermissionScope } from "@prisma/client";
import type Redis from "ioredis";
import { PrismaService } from "@/database/prisma/prisma.service";
import { REDIS_CLIENT } from "@/redis/redis.constants";

export interface ResolvedPermission {
  key: string;
  scope: PermissionScope;
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 0,
  BRANCH: 1,
  ALL: 2,
};

const CACHE_TTL_SECONDS = 300;

/**
 * Resolves a user's effective permission set (union across all their roles,
 * taking the widest scope when a permission is granted by multiple roles) and
 * caches it in Redis. Invalidated explicitly whenever a user's roles or a
 * role's permissions change — TTL is a safety net, not the primary
 * invalidation mechanism.
 */
@Injectable()
export class PermissionCacheService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private cacheKey(userId: string): string {
    return `perm:user:${userId}`;
  }

  async getUserPermissions(userId: string): Promise<ResolvedPermission[]> {
    const cached = await this.redis.get(this.cacheKey(userId));
    if (cached) {
      return JSON.parse(cached) as ResolvedPermission[];
    }

    const fresh = await this.loadFromDb(userId);
    await this.redis.set(
      this.cacheKey(userId),
      JSON.stringify(fresh),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return fresh;
  }

  async hasPermission(userId: string, key: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some((p) => p.key === key);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.redis.del(this.cacheKey(userId));
  }

  /** Distinct userIds holding any role granted the given permission key — used for notification fan-out. */
  async findUserIdsWithPermission(key: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { role: { permissions: { some: { permission: { key } } } } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return userRoles.map((ur) => ur.userId);
  }

  async invalidateUsersWithRole(roleId: string): Promise<void> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    await Promise.all(userRoles.map((ur) => this.invalidateUser(ur.userId)));
  }

  private async loadFromDb(userId: string): Promise<ResolvedPermission[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    const resolved = new Map<string, PermissionScope>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        const key = rolePermission.permission.key;
        const existing = resolved.get(key);
        if (!existing || SCOPE_RANK[rolePermission.scope] > SCOPE_RANK[existing]) {
          resolved.set(key, rolePermission.scope);
        }
      }
    }

    return Array.from(resolved.entries()).map(([key, scope]) => ({ key, scope }));
  }
}
