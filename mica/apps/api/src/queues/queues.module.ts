import { Global, Module } from "@nestjs/common";
import { BullmqModule } from "./bullmq.module";
import { MailerService } from "./mailer.service";
import { EmailProcessor } from "./email.processor";
import { GraphEmailProvider } from "./providers/graph-email.provider";

@Global()
@Module({
  imports: [BullmqModule],
  providers: [MailerService, EmailProcessor, GraphEmailProvider],
  exports: [BullmqModule, MailerService],
})
export class QueuesModule {}
