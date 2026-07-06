import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRoleInput, SetRolePermissionsInput, UpdateRoleInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";

@Injectable()
export class RolesPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({ orderBy: { key: "asc" } });
    const grouped = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const bucket = grouped.get(permission.resource) ?? [];
      bucket.push(permission);
      grouped.set(permission.resource, bucket);
    }
    return Array.from(grouped.entries()).map(([resource, items]) => ({ resource, permissions: items }));
  }

  async listRoles() {
    return this.prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
  }

  async findRole(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async createRole(dto: CreateRoleInput, actingUserId: string) {
    const existing = await this.prisma.role.findFirst({
      where: { name: dto.name, branchId: dto.branchId ?? null },
    });
    if (existing) throw new ConflictException("A role with this name already exists in this scope");

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        branchId: dto.branchId ?? null,
        isSystem: false,
        createdById: actingUserId,
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleInput, actingUserId: string) {
    const role = await this.findRole(id);
    return this.prisma.role.update({
      where: { id: role.id },
      data: { name: dto.name, description: dto.description, updatedById: actingUserId },
    });
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.findRole(id);
    if (role.isSystem) throw new BadRequestException("System roles cannot be deleted");

    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.permissionCache.invalidateUsersWithRole(id);
  }

  async setRolePermissions(id: string, dto: SetRolePermissionsInput): Promise<void> {
    const role = await this.findRole(id);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissions.map((p) => ({
          roleId: role.id,
          permissionId: p.permissionId,
          scope: p.scope,
        })),
      }),
    ]);

    await this.permissionCache.invalidateUsersWithRole(id);
  }
}
