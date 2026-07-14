import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateOwnProfileSchema,
  type LoginResponse,
  type UpdateOwnProfileInput,
} from "@mica-mab/shared-types";
import { Public } from "@/common/decorators/public.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { UsersService } from "@/modules/users/users.service";
import type { RequestUser } from "./types/request-user.type";
import { AuthService, type DeviceContext } from "./auth.service";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/auth";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: { email: string; password: string; rememberMe: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const user = await this.authService.validateCredentials(body.email, body.password);
    if (user.status === "INVITED") {
      return {
        mustChangePassword: true,
        passwordResetToken: this.authService.createPasswordResetToken(user.id),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
        },
      };
    }

    const { accessToken, refreshToken, expiresAt } = await this.authService.issueTokensForUser(
      user.id,
      body.rememberMe,
      this.deviceContext(req),
    );
    this.setRefreshCookie(res, refreshToken, expiresAt);

    const authUser = await this.authService.getAuthUser(user.id);
    return { accessToken, user: authUser };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) throw new UnauthorizedException("Missing refresh token");

    const { accessToken, refreshToken, expiresAt } = await this.authService.refresh(
      rawToken,
      this.deviceContext(req),
    );
    this.setRefreshCookie(res, refreshToken, expiresAt);
    return { accessToken };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) await this.authService.revokeSession(rawToken);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Post("logout-all")
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.revokeAllSessions(user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Get("me")
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getAuthUser(user.id);
  }

  @Patch("me")
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateOwnProfileSchema)) body: UpdateOwnProfileInput,
  ) {
    return this.usersService.updateOwnProfile(user.id, body);
  }

  @Get("sessions")
  async sessions(@CurrentUser() user: RequestUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: RequestUser,
    @Param("id") sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSessionById(user.id, sessionId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(202)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string },
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(body.email);
    return { message: "If that email is registered, a reset link has been sent." };
  }

  /** Technical Support: pending "forgot password" requests. */
  @Get("reset-requests")
  @Permissions("users:update")
  listResetRequests() {
    return this.authService.listResetRequests();
  }

  /** Technical Support: issue a reset link for a request + get the user's phone. */
  @Post("reset-requests/:id/handle")
  @Permissions("users:update")
  handleResetRequest(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.authService.handleResetRequest(id, user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string },
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(body.token, body.password);
    return { message: "Password has been reset. Please log in again." };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private deviceContext(req: Request): DeviceContext {
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    };
  }
}
