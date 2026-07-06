import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateSparePartInput, UpdateSparePartInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string) {
    return this.prisma.sparePart.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    const part = await this.prisma.sparePart.findFirst({ where: { id, deletedAt: null } });
    if (!part) throw new NotFoundException("Spare part not found");
    return part;
  }

  async create(dto: CreateSparePartInput, actingUserId: string) {
    const existing = await this.prisma.sparePart.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException("A spare part with this SKU already exists");

    return this.prisma.sparePart.create({ data: { ...dto, createdById: actingUserId } });
  }

  async update(id: string, dto: UpdateSparePartInput, actingUserId: string) {
    await this.findById(id);
    return this.prisma.sparePart.update({
      where: { id },
      data: { ...dto, updatedById: actingUserId },
    });
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.sparePart.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  /** Consumes stock against a maintenance request, snapshotting unit cost and blocking over-consumption. */
  async consume(maintenanceRequestId: string, sparePartId: string, quantityUsed: number) {
    return this.prisma.$transaction(async (tx) => {
      const sparePart = await tx.sparePart.findFirst({
        where: { id: sparePartId, deletedAt: null },
      });
      if (!sparePart) throw new NotFoundException("Spare part not found");
      if (sparePart.quantityOnHand < quantityUsed) {
        throw new BadRequestException(
          `Insufficient stock: ${sparePart.quantityOnHand} on hand, ${quantityUsed} requested`,
        );
      }

      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { quantityOnHand: { decrement: quantityUsed } },
      });

      return tx.maintenanceSparePart.create({
        data: {
          maintenanceRequestId,
          sparePartId,
          quantityUsed,
          unitCostAtUse: sparePart.unitCost,
        },
        include: { sparePart: true },
      });
    });
  }

  async listUsage(maintenanceRequestId: string) {
    return this.prisma.maintenanceSparePart.findMany({
      where: { maintenanceRequestId },
      include: { sparePart: true },
    });
  }
}
