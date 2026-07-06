import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PERMISSIONS_KEY } from "@/common/decorators/permissions.decorator";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import type { RequestUser } from "@/modules/auth/types/request-user.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException("Not authenticated");

    const granted = await this.permissionCache.getUserPermissions(user.id);
    const grantedKeys = new Set(granted.map((p) => p.key));

    const missing = required.filter((key) => !grantedKeys.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }

    return true;
  }
}
