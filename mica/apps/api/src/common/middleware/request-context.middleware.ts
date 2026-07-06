import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContextStore {
  requestId: string;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
  path: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}

/**
 * Populates AsyncLocalStorage early in the pipeline so both the
 * AuditLogInterceptor and any service can read the acting user/IP/UA without
 * threading them through every method signature. userId is filled in later by
 * JwtAuthGuard (this middleware runs before guards, so it starts null).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const store: RequestContextStore = {
      requestId: randomUUID(),
      userId: null,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      method: req.method,
      path: req.path,
    };
    requestContextStorage.run(store, next);
  }
}
