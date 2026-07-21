import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import { SettingsService } from "@/modules/settings/settings.service";
import {
  MAB_LOGO_BASE64,
  MAB_LOGO_CID,
} from "@/modules/notifications/templates/mab-logo";
import { GraphEmailProvider } from "./providers/graph-email.provider";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Mail that ships HTML only scores worse with spam filters. */
  text?: string;
}

export interface SendMailResult {
  /** Provider's id for the accepted message; the handle for tracing a delivery. */
  messageId?: string;
}

/**
 * SMTP credentials are Setting-driven when an admin has configured them via
 * the Settings UI, falling back to env vars for zero-config dev/deploy. The
 * transporter is rebuilt on every send so a credential change takes effect
 * immediately without an API restart.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly graph: GraphEmailProvider,
  ) {}

  /** The logo, when the body actually references it. */
  private logoAttachment(html: string) {
    if (!html.includes(`cid:${MAB_LOGO_CID}`)) return undefined;
    return {
      filename: "mab-logo.png",
      content: Buffer.from(MAB_LOGO_BASE64, "base64"),
      contentType: "image/png",
      cid: MAB_LOGO_CID,
    };
  }

  private async buildTransport(): Promise<{ transporter: Transporter; from: string }> {
    const stored = await this.settings.getSmtpWithSecret();

    if (stored?.host) {
      return {
        transporter: createTransport({
          host: stored.host,
          port: stored.port,
          secure: stored.secure,
          auth: stored.username ? { user: stored.username, pass: stored.password } : undefined,
        }),
        from: `${stored.fromName} <${stored.fromAddress}>`,
      };
    }

    return {
      transporter: createTransport({
        host: this.config.get<string>("smtp.host"),
        port: this.config.get<number>("smtp.port"),
        secure: this.config.get<boolean>("smtp.secure"),
        auth: this.config.get<string>("smtp.user")
          ? {
              user: this.config.get<string>("smtp.user"),
              pass: this.config.get<string>("smtp.password"),
            }
          : undefined,
      }),
      from: this.config.get<string>("smtp.from") ?? "MICA MAB Fleet <no-reply@mica-mab.local>",
    };
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    // Graph is chosen by configuration because SMTP submission is no longer
    // available on tenants that enforce modern authentication.
    if (this.config.get<string>("mail.provider") === "graph") {
      const logo = this.logoAttachment(options.html);
      return this.graph.send({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: logo ? [logo] : undefined,
      });
    }

    const { transporter, from } = await this.buildTransport();
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      // Attached inline rather than linked. Outlook and most clients block
      // remote images until the reader asks for them, so a hosted logo would
      // show as a broken box on first open — on the message asking for a
      // decision. `contentDisposition: inline` keeps it out of the paperclip.
      attachments: options.html.includes(`cid:${MAB_LOGO_CID}`)
        ? [
            {
              filename: "mab-logo.png",
              content: Buffer.from(MAB_LOGO_BASE64, "base64"),
              cid: MAB_LOGO_CID,
              contentDisposition: "inline" as const,
            },
          ]
        : undefined,
    });
    this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    return { messageId: info?.messageId };
  }
}
