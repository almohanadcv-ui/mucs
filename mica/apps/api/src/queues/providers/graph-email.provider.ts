import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "./email-provider.interface";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Sends through Microsoft Graph with an app-only (client credentials) token.
 *
 * This is the transport Microsoft still supports: basic authentication for
 * SMTP submission was disabled for Exchange Online, and a tenant with Security
 * Defaults enabled rejects it outright — no password, app password included,
 * gets through. Graph works with those protections left on, which is the point.
 *
 * The app identity may send as any mailbox the tenant allows it to. That is
 * narrowed outside this code by an Application Access Policy scoping the
 * registration to one mailbox; without that policy the credential is far more
 * powerful than this feature needs.
 */
@Injectable()
export class GraphEmailProvider implements EmailProvider {
  readonly name = "microsoft-graph";
  private readonly logger = new Logger(GraphEmailProvider.name);

  /** Tokens last an hour; re-fetching per message would be a needless round trip. */
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private cfg(key: string): string {
    const value = this.config.get<string>(`mail.graph.${key}`);
    if (!value) {
      throw new Error(
        `Microsoft Graph mail is selected but mail.graph.${key} is not set. ` +
          `Check GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET and MICA_MAIL_FROM.`,
      );
    }
    return value;
  }

  private async accessToken(): Promise<string> {
    // Refreshed a minute early so a token cannot expire mid-request.
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const tenantId = this.cfg("tenantId");
    const body = new URLSearchParams({
      client_id: this.cfg("clientId"),
      client_secret: this.cfg("clientSecret"),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      // The body names the actual cause (expired secret, consent not granted),
      // and it contains no secret of ours, so it is worth surfacing.
      const detail = await res.text();
      throw new Error(`Graph token request failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as TokenResponse;
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return this.token.value;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = this.cfg("from");
    const token = await this.accessToken();

    const payload = {
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: [{ emailAddress: { address: message.to } }],
        attachments: (message.attachments ?? []).map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.content.toString("base64"),
          contentId: a.cid,
          isInline: Boolean(a.cid),
        })),
      },
      // The sending mailbox is a system address, not someone's inbox: keeping
      // a copy of every notification would bury it in its own Sent Items.
      saveToSentItems: false,
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    this.logger.log(`Email sent via Graph to ${message.to}: ${message.subject}`);
    // sendMail answers 202 with an empty body, so there is no id to report.
    // Delivery is traced through the tenant's message trace instead.
    return {};
  }
}
