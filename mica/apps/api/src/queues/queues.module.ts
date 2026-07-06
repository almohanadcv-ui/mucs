import { Global, Module } from "@nestjs/common";
import { BullmqModule } from "./bullmq.module";
import { MailerService } from "./mailer.service";
import { EmailProcessor } from "./email.processor";

@Global()
@Module({
  imports: [BullmqModule],
  providers: [MailerService, EmailProcessor],
  exports: [BullmqModule, MailerService],
})
export class QueuesModule {}
