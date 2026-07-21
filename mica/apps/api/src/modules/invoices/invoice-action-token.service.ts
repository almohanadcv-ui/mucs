import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";

/** A week: long enough for a manager on leave, short enough to expire. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TokenFailure = "unknown" | "expired" | "used";

export interface TokenClaims {
  invoiceId: string;
  userId: string;
}

/**
 * Issues and checks the one-time links carried in approval emails.
 *
 * The token is deliberately *not* an authorisation. It says "this email was
 * sent to this person about this invoice"; the decision endpoint still demands
 * a signed-in user holding `invoices:approve`. A forwarded email therefore
 * cannot approve anything, which is the failure mode a link-only design has.
 */
@Injectable()
export class InvoiceActionTokenService {
  private readonly logger = new Logger(InvoiceActionTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Returns the plaintext token — the only moment it exists outside the email. */
  async issue(invoiceId: string, userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.invoiceActionToken.create({
      data: {
        tokenHash: InvoiceActionTokenService.hash(token),
        invoiceId,
        userId,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return token;
  }

  /**
   * Resolves a token without consuming it, so opening the page is safe to
   * repeat — a mail scanner or a link preview must not burn the manager's link
   * before they click it.
   */
  async peek(token: string): Promise<TokenClaims | TokenFailure> {
    const row = await this.prisma.invoiceActionToken.findUnique({
      where: { tokenHash: InvoiceActionTokenService.hash(token) },
    });
    if (!row) return "unknown";
    if (row.usedAt) return "used";
    if (row.expiresAt < new Date()) return "expired";
    return { invoiceId: row.invoiceId, userId: row.userId };
  }

  /**
   * Marks the token spent, refusing if it already was. The conditional update
   * is what makes a double-submit safe: two requests race, one matches a row,
   * the other gets false and is turned away before any decision is written.
   */
  async consume(token: string): Promise<boolean> {
    const { count } = await this.prisma.invoiceActionToken.updateMany({
      where: {
        tokenHash: InvoiceActionTokenService.hash(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }

  /**
   * Retires every outstanding link for an invoice once it has been decided, so
   * a second manager following an older email is told the decision is made
   * rather than shown a live-looking form.
   */
  async revokeForInvoice(invoiceId: string): Promise<void> {
    await this.prisma.invoiceActionToken.updateMany({
      where: { invoiceId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
