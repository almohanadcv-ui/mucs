import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "@/common/decorators/public.decorator";
import { getRequestContext } from "@/common/middleware/request-context.middleware";
import type { AccessTokenPayload, RequestUser } from "@/modules/auth/types/request-user.type";

/**
 * Global guard: verifies the access token (Authorization: Bearer <token>)
 * unless the route is marked @Public(). Attaches a minimal RequestUser to
 * req.user; permission checks happen in PermissionsGuard, which runs after
 * this one and resolves the FRESH permission set from PermissionCacheService
 * rather than trusting anything embedded in the token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Missing access token");

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.get<string>("jwt.accessSecret"),
      });
      const user: RequestUser = {
        id: payload.sub,
        email: payload.email,
        branchId: payload.branchId,
        departmentId: payload.departmentId,
      };
      (request as Request & { user: RequestUser }).user = user;

      const ctx = getRequestContext();
      if (ctx) ctx.userId = user.id;

      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length);
  }
}
