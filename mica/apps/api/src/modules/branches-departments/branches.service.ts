import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateBranchInput, UpdateBranchInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  async create(dto: CreateBranchInput, actingUserId: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("A branch with this code already exists");

    return this.prisma.branch.create({
      data: { ...dto, createdById: actingUserId },
    });
  }

  async update(id: string, dto: UpdateBranchInput, actingUserId: string) {
    await this.findById(id);
    return this.prisma.branch.update({
      where: { id },
      data: { ...dto, updatedById: actingUserId },
    });
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }
}
