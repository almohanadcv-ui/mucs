import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type {
  CreateUserInput,
  PaginationQuery,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import { EMAIL_QUEUE } from "@/queues/bullmq.module";
import type { EmailJobData } from "@/queues/email.processor";

const INVITE_TOKEN_PURPOSE = "password-reset";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionCache: PermissionCacheService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  async list(query: PaginationQuery) {
    const where = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" as const } },
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.sortDir },
        include: { roles: { include: { role: true } }, branch: true, department: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.toSafeUser(u)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { include: { role: true } }, branch: true, department: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return this.toSafeUser(user);
  }

  async create(dto: CreateUserInput, actingUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("A user with this email already exists");

    const temporaryPassword = randomBytes(9).toString("base64url");
    const passwordHash = await argon2.hash(temporaryPassword);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        passwordHash,
        status: "INVITED",
        createdById: actingUserId,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { roles: { include: { role: true } }, branch: true, department: true },
    });

    const inviteToken = this.jwtService.sign(
      { sub: user.id, purpose: INVITE_TOKEN_PURPOSE },
      { secret: this.configService.get<string>("jwt.accessSecret"), expiresIn: "7d" },
    );

    const webOrigin = this.configService.get<string>("app.corsOrigin") ?? "http://localhost:3001";
    const setPasswordUrl = `${webOrigin}/reset-password?token=${inviteToken}`;

    // Queue the invite email (best-effort). If SMTP isn't configured/reachable
    // the job will simply fail and retry in the background — user creation must
    // never fail because of it, and the admin always gets the link back in the
    // response to share manually.
    try {
      await this.emailQueue.add("send", {
        to: user.email,
        subject: "You've been invited to MICA MAB Fleet",
        html: `<p>Hi ${user.firstName},</p>
<p>An account has been created for you on MICA MAB Fleet. Set your password to sign in:</p>
<p><a href="${setPasswordUrl}">Set your password</a></p>
<p>This link expires in 7 days.</p>`,
      });
    } catch (error) {
      this.logger.warn(`Failed to queue invite email for ${user.email}: ${(error as Error).message}`);
    }

    this.logger.log(`Invited ${user.email}. Set-password link: ${setPasswordUrl}`);

    return { ...this.toSafeUser(user), setPasswordUrl, temporaryPassword };
  }

  async update(id: string, dto: UpdateUserInput, actingUserId: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException("User not found");

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        status: dto.status,
        updatedById: actingUserId,
        ...(dto.roleIds
          ? {
              roles: {
                deleteMany: {},
                create: dto.roleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
      },
      include: { roles: { include: { role: true } }, branch: true, department: true },
    });

    await this.permissionCache.invalidateUser(id);
    return this.toSafeUser(user);
  }

  async updateOwnProfile(id: string, dto: UpdateOwnProfileInput) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        updatedById: id,
      },
      include: { roles: { include: { role: true } }, branch: true, department: true },
    });
    return this.toSafeUser(user);
  }

  async suspend(id: string, actingUserId: string) {
    await this.prisma.user.update({
      where: { id },
      data: { status: "SUSPENDED", updatedById: actingUserId },
    });
    await this.prisma.session.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.permissionCache.invalidateUser(id);
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException("User not found");

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
    await this.prisma.session.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.permissionCache.invalidateUser(id);
  }

  private toSafeUser<T extends { passwordHash: string; twoFactorSecret: string | null }>(
    user: T,
  ): Omit<T, "passwordHash" | "twoFactorSecret"> {
    const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, ...safe } = user;
    return safe;
  }
}
