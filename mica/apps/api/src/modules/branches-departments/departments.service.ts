import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string) {
    return this.prisma.department.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: { name: "asc" },
      include: { branch: true },
    });
  }

  async findById(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: { branch: true, teams: true },
    });
    if (!department) throw new NotFoundException("Department not found");
    return department;
  }

  async create(dto: CreateDepartmentInput, actingUserId: string) {
    return this.prisma.department.create({
      data: { ...dto, createdById: actingUserId },
    });
  }

  async update(id: string, dto: UpdateDepartmentInput, actingUserId: string) {
    await this.findById(id);
    return this.prisma.department.update({
      where: { id },
      data: { ...dto, updatedById: actingUserId },
    });
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }
}
