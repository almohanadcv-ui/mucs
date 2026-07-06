import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDriverInput, PaginationQuery, UpdateDriverInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQuery, filters: { branchId?: string; status?: string }) {
    const where = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { employeeCode: { contains: query.search, mode: "insensitive" as const } },
              { licenseNumber: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.sortDir },
        include: { branch: true, currentVehicles: true },
      }),
      this.prisma.driver.count({ where }),
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
    const driver = await this.prisma.driver.findFirst({
      where: { id, deletedAt: null },
      include: { branch: true, currentVehicles: true },
    });
    if (!driver) throw new NotFoundException("Driver not found");
    return driver;
  }

  async create(dto: CreateDriverInput, actingUserId: string) {
    const existing = await this.prisma.driver.findFirst({
      where: { OR: [{ employeeCode: dto.employeeCode }, { licenseNumber: dto.licenseNumber }] },
    });
    if (existing) {
      const field = existing.employeeCode === dto.employeeCode ? "employee code" : "license number";
      throw new ConflictException(`A driver with this ${field} already exists`);
    }
    if (dto.userId) await this.assertUserLinkable(dto.userId);

    return this.prisma.driver.create({
      data: {
        ...dto,
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : undefined,
        createdById: actingUserId,
      },
    });
  }

  async update(id: string, dto: UpdateDriverInput, actingUserId: string) {
    await this.findById(id);
    if (dto.userId) await this.assertUserLinkable(dto.userId, id);

    return this.prisma.driver.update({
      where: { id },
      data: {
        ...dto,
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : undefined,
        updatedById: actingUserId,
      },
    });
  }

  /** Guards Driver.userId linkage: target must exist, hold the Driver role,
   *  and not already be linked to a different driver record. */
  private async assertUserLinkable(userId: string, excludeDriverId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    if (!user.roles.some((ur) => ur.role.name === "Driver")) {
      throw new BadRequestException("The selected user does not hold the Driver role");
    }

    const alreadyLinked = await this.prisma.driver.findFirst({
      where: { userId, deletedAt: null, ...(excludeDriverId ? { id: { not: excludeDriverId } } : {}) },
    });
    if (alreadyLinked) throw new ConflictException("This user is already linked to another driver");
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.driver.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }
}
