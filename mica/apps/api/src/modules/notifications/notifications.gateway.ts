import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "@/modules/auth/types/request-user.type";

/**
 * Clients connect with `{ auth: { token: <access token> } }` and are joined
 * to a per-user room, so in-app notifications reach only that user's open
 * tabs/devices without a broadcast-and-filter round trip.
 */
@WebSocketGateway({
  namespace: "/notifications",
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3001", credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.get<string>("jwt.accessSecret"),
      });
      client.join(this.userRoom(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(this.userRoom(userId)).emit(event, data);
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
