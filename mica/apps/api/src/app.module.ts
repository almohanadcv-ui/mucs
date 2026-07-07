import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "@/config/app.config";
import databaseConfig from "@/config/database.config";
import redisConfig from "@/config/redis.config";
import jwtConfig from "@/config/jwt.config";
import storageConfig from "@/config/storage.config";
import smtpConfig from "@/config/smtp.config";
import backupConfig from "@/config/backup.config";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { RedisModule } from "@/redis/redis.module";
import { PermissionCacheModule } from "@/common/permission-cache/permission-cache.module";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { AuditLogInterceptor } from "@/common/interceptors/audit-log.interceptor";
import { RequestContextMiddleware } from "@/common/middleware/request-context.middleware";
import { HealthModule } from "@/health/health.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { UsersModule } from "@/modules/users/users.module";
import { RolesPermissionsModule } from "@/modules/roles-permissions/roles-permissions.module";
import { BranchesDepartmentsModule } from "@/modules/branches-departments/branches-departments.module";
import { AuditLogModule } from "@/modules/audit-log/audit-log.module";
import { StorageModule } from "@/storage/storage.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";
import { DriversModule } from "@/modules/drivers/drivers.module";
import { MediaModule } from "@/modules/media/media.module";
import { SettingsModule } from "@/modules/settings/settings.module";
import { WorkflowModule } from "@/modules/workflow/workflow.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { AppointmentsModule } from "@/modules/appointments/appointments.module";
import { QueuesModule } from "@/queues/queues.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { DashboardModule } from "@/modules/dashboard/dashboard.module";
import { SearchModule } from "@/modules/search/search.module";
import { SavedFiltersModule } from "@/modules/saved-filters/saved-filters.module";
import { ReportsModule } from "@/modules/reports/reports.module";
import { ApiKeysModule } from "@/modules/api-keys/api-keys.module";
import { WebhooksModule } from "@/modules/webhooks/webhooks.module";
import { BackupModule } from "@/modules/backup/backup.module";
import { InvoicesModule } from "@/modules/invoices/invoices.module";
import { RemindersModule } from "@/modules/reminders/reminders.module";
import { DriverPortalModule } from "@/modules/driver-portal/driver-portal.module";
import { PhotoRequestsModule } from "@/modules/photo-requests/photo-requests.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, storageConfig, smtpConfig, backupConfig],
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({}),
    // Global default: 100 req/min per IP. Auth endpoints override with a
    // stricter per-route @Throttle (see AuthController) since credential
    // guessing/brute-force needs a much tighter budget than normal API use.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    PermissionCacheModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesPermissionsModule,
    BranchesDepartmentsModule,
    AuditLogModule,
    StorageModule,
    VehiclesModule,
    DriversModule,
    MediaModule,
    SettingsModule,
    WorkflowModule,
    MaintenanceModule,
    AppointmentsModule,
    QueuesModule,
    NotificationsModule,
    DashboardModule,
    SearchModule,
    SavedFiltersModule,
    ReportsModule,
    ApiKeysModule,
    WebhooksModule,
    BackupModule,
    InvoicesModule,
    RemindersModule,
    DriverPortalModule,
    PhotoRequestsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
