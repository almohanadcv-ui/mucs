import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

export const EMAIL_QUEUE = "email";
export const WEBHOOK_DELIVERY_QUEUE = "webhook-delivery";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("redis.url") },
      }),
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
    BullModule.registerQueue({
      name: WEBHOOK_DELIVERY_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  exports: [BullModule],
})
export class BullmqModule {}
