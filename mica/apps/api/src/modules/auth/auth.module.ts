import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "@/modules/users/users.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginChallengeService } from "./login-challenge.service";

@Module({
  imports: [JwtModule.register({}), UsersModule, NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, LoginChallengeService],
  exports: [AuthService],
})
export class AuthModule {}
