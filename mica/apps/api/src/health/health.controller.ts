import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { Public } from "@/common/decorators/public.decorator";
import { PrismaHealthIndicator } from "./prisma-health.indicator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaIndicator.isHealthy("database")]);
  }

  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaIndicator.isHealthy("database")]);
  }
}
