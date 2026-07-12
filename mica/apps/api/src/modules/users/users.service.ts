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

  /** The "Driver" system role id, or null if it hasn't been seeded yet. */
  private async getDriverRoleId(): Promise<string | null> {
    const role = await this.prisma.role.findFirst({ where: { name: "Driver", branchId: null } });
    return role?.id ?? null;
  }

  /** A privileged creator (Technical Support) may assign any role and see every
   *  user. Everyone else (e.g. a Mechanic granted users:invite) is restricted to
   *  creating Driver logins and only sees the users they created themselves. */
  private async isPrivilegedManager(actingUserId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId: actingUserId, role: { name: "Technical Support" } },
    });
    return count > 0;
  }

  /**
   * Every user holding the Driver role gets a Driver profile automatically, so
   * the workshop no longer maintains a separate "drivers" list — a Driver login
   * IS the driver. Vehicles, photo requests and appointments still reference the
   * Driver row, so we create one on demand (idempotent) and reuse the account's
   * name. License/employee code are auto-generated placeholders (unique per user)
   * since those details aren't collected at invite time.
   */
  private async ensureDriverProfile(
    user: {
      id: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      branchId: string | null;
    },
    actingUserId: string,
  ): Promise<void> {
    const existing = await this.prisma.driver.findFirst({ where: { userId: user.id } });
    if (existing) {
      // Reactivate and/or keep the phone in sync with the account.
      await this.prisma.driver.update({
        where: { id: existing.id },
        data: {
          ...(existing.deletedAt ? { deletedAt: null, status: "ACTIVE" } : {}),
          ...(user.phone ? { phone: user.phone } : {}),
          updatedById: actingUserId,
        },
      });
      return;
    }

    const branchId = user.branchId ?? (await this.prisma.branch.findFirst({ orderBy: { createdAt: "asc" } }))?.id;
    if (!branchId) {
      this.logger.warn(`Cannot create driver profile for ${user.id}: no branch exists.`);
      return;
    }

    await this.prisma.driver.create({
      data: {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        employeeCode: `DRV-${user.id.slice(-10).toUpperCase()}`,
        licenseNumber: `AUTO-${user.id}`,
        branchId,
        status: "ACTIVE",
        createdById: actingUserId,
      },
    });
  }

  async list(query: PaginationQuery, actingUserId?: string) {
    const restrictToOwn =
      actingUserId !== undefined && !(await this.isPrivilegedManager(actingUserId));
    const where = {
      deletedAt: null,
      AND: [
        // A non-privileged inviter (Mechanic) sees the users they created PLUS
        // every Driver, so they know which driver to request photos/appointments from.
        restrictToOwn
          ? {
              OR: [
                { createdById: actingUserId },
                { roles: { some: { role: { name: "Driver" } } } },
              ],
            }
          : {},
        query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: "insensitive" as const } },
                { firstName: { contains: query.search, mode: "insensitive" as const } },
                { lastName: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {},
      ],
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

    // A non-privileged creator (e.g. a Mechanic) may only create Driver logins —
    // force the role server-side regardless of what was submitted.
    const driverRoleId = await this.getDriverRoleId();
    const privileged = await this.isPrivilegedManager(actingUserId);
    const roleIds = privileged ? dto.roleIds : driverRoleId ? [driverRoleId] : [];

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
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      include: { roles: { include: { role: true } }, branch: true, department: true },
    });

    // Assigning the Driver role auto-provisions the matching Driver profile.
    if (driverRoleId && roleIds.includes(driverRoleId)) {
      await this.ensureDriverProfile(user, actingUserId);
    }

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

    // Keep the Driver profile in sync when roles change through an edit.
    if (dto.roleIds) {
      const driverRoleId = await this.getDriverRoleId();
      if (driverRoleId && dto.roleIds.includes(driverRoleId)) {
        await this.ensureDriverProfile(user, actingUserId);
      }
    }

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
