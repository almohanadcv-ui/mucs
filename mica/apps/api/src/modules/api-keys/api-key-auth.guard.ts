import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { ApiKeysService } from "./api-keys.service";

export interface RequestWithApiKey extends Request {
  apiKey?: { id: string; scopes: string[]; createdById: string | null };
}

/**
 * Authenticates machine-to-machine requests via the `x-api-key` header,
 * independent of the JWT/cookie session used by the web app. Apply on
 * routes intended for external API consumers, combined with `@Public()`
 * so the global JwtAuthGuard doesn't demand a Bearer token first.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const rawKey = request.headers["x-api-key"];
    if (!rawKey || Array.isArray(rawKey)) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    request.apiKey = await this.apiKeys.authenticate(rawKey);
    return true;
  }
}
