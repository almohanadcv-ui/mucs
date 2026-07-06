import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  companySettingsSchema,
  smtpSettingsSchema,
  themeSettingsSchema,
  type CompanySettingsInput,
  type SmtpSettingsInput,
  type ThemeSettingsInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { MailerService } from "@/queues/mailer.service";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  @Get("company")
  @Permissions("settings:view")
  getCompany() {
    return this.settings.getCompany();
  }

  @Put("company")
  @Permissions("settings:update")
  async updateCompany(
    @Body(new ZodValidationPipe(companySettingsSchema)) body: CompanySettingsInput,
    @CurrentUser() user: RequestUser,
  ) {
    await this.settings.setCompany(body, user.id);
    return this.settings.getCompany();
  }

  @Get("smtp")
  @Permissions("settings:view")
  getSmtp() {
    return this.settings.getSmtp();
  }

  @Put("smtp")
  @Permissions("settings:update")
  async updateSmtp(
    @Body(new ZodValidationPipe(smtpSettingsSchema)) body: SmtpSettingsInput,
    @CurrentUser() user: RequestUser,
  ) {
    await this.settings.setSmtp(body, user.id);
    return this.settings.getSmtp();
  }

  @Post("smtp/test")
  @Permissions("settings:update")
  async testSmtp(@CurrentUser() user: RequestUser) {
    await this.mailer.send({
      to: user.email,
      subject: "MICA MAB — SMTP test",
      html: "<p>This is a test email from your MICA MAB Fleet settings page. If you received this, SMTP is configured correctly.</p>",
    });
    return { sent: true };
  }

  @Get("theme")
  @Permissions("settings:view")
  getTheme() {
    return this.settings.getTheme();
  }

  @Put("theme")
  @Permissions("settings:update")
  async updateTheme(
    @Body(new ZodValidationPipe(themeSettingsSchema)) body: ThemeSettingsInput,
    @CurrentUser() user: RequestUser,
  ) {
    await this.settings.setTheme(body, user.id);
    return this.settings.getTheme();
  }
}
