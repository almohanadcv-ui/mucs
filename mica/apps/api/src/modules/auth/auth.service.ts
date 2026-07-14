import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import ms from "@/common/utils/ms";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { generateOpaqueToken, hashToken } from "./utils/token.util";
import type { AccessTokenPayload } from "./types/request-user.type";
import type { AuthUser } from "@mica-mab/shared-types";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_PURPOSE = "password-reset";

export interface DeviceContext {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionCache: PermissionCacheService,
    private readonly notifications: NotificationsService,
  ) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    if (user.status === "SUSPENDED") {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
        },
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: user.status === "ACTIVE" ? new Date() : user.lastLoginAt,
      },
    });

    return user;
  }

  createPasswordResetToken(userId: string, expiresIn = "20m"): string {
    return this.jwtService.sign(
      { sub: userId, purpose: RESET_TOKEN_PURPOSE },
      { secret: this.configService.get<string>("jwt.accessSecret"), expiresIn },
    );
  }

  async issueTokensForUser(
    userId: string,
    rememberMe: boolean,
    device: DeviceContext,
    deviceLabel?: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const accessToken = this.signAccessToken(user);
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(
      Date.now() + ms(rememberMe ? "30d" : "1d"),
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        deviceLabel: deviceLabel ?? null,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async refresh(rawRefreshToken: string, device: DeviceContext) {
    const tokenHash = hashToken(rawRefreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is no longer active");
    }

    const newRefreshToken = generateOpaqueToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: hashToken(newRefreshToken),
        lastUsedAt: new Date(),
        userAgent: device.userAgent ?? session.userAgent,
        ipAddress: device.ipAddress ?? session.ipAddress,
      },
    });

    const accessToken = this.signAccessToken(user);
    return { accessToken, refreshToken: newRefreshToken, expiresAt: session.expiresAt };
  }

  async revokeSession(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.session.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSessionById(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException("Session does not belong to the current user");
    }
    await this.prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const permissions = await this.permissionCache.getUserPermissions(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      branchId: user.branchId,
      departmentId: user.departmentId,
      roles: user.roles.map((ur) => ur.role.name),
      permissions: permissions.map((p) => p.key),
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Always behave the same whether the user exists or not — avoids leaking
    // which emails are registered.
    if (!user) return;

    // No public SMTP: instead of emailing the user, raise an in-app request to
    // Technical Support so they reset the password and hand over the link.
    const supportUsers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        roles: { some: { role: { name: "Technical Support" } } },
      },
      select: { id: true },
    });
    await Promise.all(
      supportUsers.map((s) =>
        this.notifications.notify({
          recipientId: s.id,
          type: "password.reset_requested",
          title: "طلب استعادة كلمة المرور",
          body: `طلب المستخدم ${user.firstName} ${user.lastName} (${email}) استعادة كلمة المرور — أعد تعيينها له من صفحة المستخدمين.`,
          payload: { userId: user.id, email },
          channels: ["IN_APP"],
        }),
      ),
    );
    this.logger.log(`Password reset requested for ${email} — notified ${supportUsers.length} support user(s).`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("jwt.accessSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    if (payload.purpose !== RESET_TOKEN_PURPOSE) {
      throw new UnauthorizedException("Invalid reset token");
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        // An invited user setting their password for the first time becomes
        // active; an already-active user resetting theirs stays active.
        status: "ACTIVE",
      },
    });

    // Force re-login on every device once the password changes.
    await this.revokeAllSessions(payload.sub);
  }

  private signAccessToken(user: {
    id: string;
    email: string;
    branchId: string | null;
    departmentId: string | null;
  }): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      branchId: user.branchId,
      departmentId: user.departmentId,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.accessSecret"),
      expiresIn: this.configService.get<string>("jwt.accessExpiresIn"),
    });
  }
}
