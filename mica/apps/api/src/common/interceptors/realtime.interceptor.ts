import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { NotificationsGateway } from "@/modules/notifications/notifications.gateway";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SKIP_PATH_PREFIXES = ["/auth/", "/health"];

/**
 * After any successful mutating request, broadcast a "data.changed" signal over
 * the socket so every connected client refetches the affected lists in real
 * time — no polling, no manual refresh. The signal carries the resource name
 * (the controller) so clients can invalidate precisely.
 */
@Injectable()
export class RealtimeInterceptor implements NestInterceptor {
  constructor(private readonly gateway: NotificationsGateway) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(request.method)) return next.handle();
    if (SKIP_PATH_PREFIXES.some((p) => request.path.startsWith(p))) return next.handle();

    const resource = context.getClass().name.replace(/Controller$/, "").toLowerCase();
    return next.handle().pipe(tap({ next: () => this.gateway.emitDataChanged(resource) }));
  }
}
