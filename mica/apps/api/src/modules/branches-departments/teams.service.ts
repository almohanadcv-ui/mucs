import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateTeamInput, UpdateTeamInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list(departmentId?: string) {
    return this.prisma.team.findMany({
      where: { deletedAt: null, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      include: { members: { include: { user: true } } },
    });
  }

  async findById(id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, deletedAt: null },
      include: { members: { include: { user: true } } },
    });
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  async create(dto: CreateTeamInput, actingUserId: string) {
    return this.prisma.team.create({ data: { ...dto, createdById: actingUserId } });
  }

  async update(id: string, dto: UpdateTeamInput, actingUserId: string) {
    await this.findById(id);
    return this.prisma.team.update({
      where: { id },
      data: { ...dto, updatedById: actingUserId },
    });
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    await this.findById(id);
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  async addMember(teamId: string, userId: string) {
    await this.findById(teamId);
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) throw new ConflictException("User is already a member of this team");

    return this.prisma.teamMember.create({ data: { teamId, userId } });
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  }
}
