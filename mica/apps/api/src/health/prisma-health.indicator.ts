import { Injectable } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      const result = this.getStatus(key, false, { message: (error as Error).message });
      throw new HealthCheckError("Prisma health check failed", result);
    }
  }
}
