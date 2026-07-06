import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { Observable, tap } from "rxjs";
import { PrismaService } from "@/database/prisma/prisma.service";
import { getRequestContext } from "@/common/middleware/request-context.middleware";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SKIP_PATH_PREFIXES = ["/auth/login", "/auth/refresh", "/auth/logout", "/health"];
const SENSITIVE_KEYS = new Set(["passwordHash", "twoFactorSecret", "tokenHash"]);

/**
 * Global, fire-and-forget audit capture: every mutating request produces one
 * AuditLog row (user/IP/UA/method/path/status + the resulting entity state),
 * written without blocking the response. Deliberately does NOT attempt a
 * generic "before" diff — that requires entity-specific knowledge of which
 * table to pre-fetch, so true before/after diffing is added per-domain where
 * it matters most (e.g. MaintenanceStatusHistory in the workflow module)
 * rather than faked here.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }
    if (SKIP_PATH_PREFIXES.some((prefix) => request.path.startsWith(prefix))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          this.record(context, request, 200, responseBody).catch((error) =>
            this.logger.error(`Failed to write audit log: ${error}`),
          );
        },
        error: (error) => {
          const statusCode = error?.status ?? 500;
          this.record(context, request, statusCode, null).catch((err) =>
            this.logger.error(`Failed to write audit log: ${err}`),
          );
        },
      }),
    );
  }

  private async record(
    context: ExecutionContext,
    request: Request,
    statusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    const ctx = getRequestContext();
    const controllerName = context.getClass().name.replace("Controller", "");
    const rawParamId = request.params?.id;
    const entityId =
      (typeof rawParamId === "string" ? rawParamId : undefined) ??
      this.extractId(responseBody) ??
      null;

    await this.prisma.auditLog.create({
      data: {
        userId: ctx?.userId ?? null,
        action: `${controllerName.toLowerCase()}.${request.method.toLowerCase()}`,
        entityType: controllerName || null,
        entityId,
        ipAddress: ctx?.ipAddress ?? null,
        userAgent: ctx?.userAgent ?? null,
        method: request.method,
        path: request.path,
        statusCode,
        requestId: ctx?.requestId ?? null,
        changesAfter:
          statusCode < 400
            ? (this.sanitize(responseBody) as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  private extractId(body: unknown): string | null {
    if (body && typeof body === "object" && "id" in body) {
      const id = (body as { id: unknown }).id;
      return typeof id === "string" ? id : null;
    }
    return null;
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.sanitize(v));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !SENSITIVE_KEYS.has(key))
          .map(([key, val]) => [key, this.sanitize(val)]),
      );
    }
    return value;
  }
}
