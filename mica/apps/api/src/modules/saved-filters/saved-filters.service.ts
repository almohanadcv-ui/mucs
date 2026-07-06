import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateSavedFilterInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class SavedFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, module: string) {
    return this.prisma.savedFilter.findMany({
      where: { module, OR: [{ userId }, { isShared: true }] },
      orderBy: { name: "asc" },
    });
  }

  create(userId: string, dto: CreateSavedFilterInput) {
    return this.prisma.savedFilter.create({
      data: {
        userId,
        name: dto.name,
        module: dto.module,
        filterJson: dto.filterJson as Prisma.InputJsonValue,
        isShared: dto.isShared,
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const filter = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!filter) throw new NotFoundException("Saved filter not found");
    if (filter.userId !== userId) throw new ForbiddenException("Cannot delete another user's filter");
    await this.prisma.savedFilter.delete({ where: { id } });
  }
}
