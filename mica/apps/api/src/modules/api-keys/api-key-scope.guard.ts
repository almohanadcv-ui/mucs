import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_KEY_SCOPES_KEY } from "./api-key-scopes.decorator";
import type { RequestWithApiKey } from "./api-key-auth.guard";

/** Runs after ApiKeyAuthGuard; checks request.apiKey.scopes against @ApiKeyScopes(...). */
@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const scopes = new Set(request.apiKey?.scopes ?? []);
    const missing = required.filter((scope) => !scopes.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`API key missing scope(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
