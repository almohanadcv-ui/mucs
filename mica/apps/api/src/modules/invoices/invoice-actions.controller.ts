import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Public } from "@/common/decorators/public.decorator";
import { Throttle } from "@nestjs/throttler";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { InvoicesService } from "./invoices.service";

export const decideFromEmailSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    rejectionReason: z.string().trim().min(3).optional(),
  })
  // Enforced here as well as in the UI: a rejection with no reason leaves the
  // mechanic nothing to act on, and the client is not the place to guarantee it.
  .refine((v) => v.decision !== "reject" || !!v.rejectionReason, {
    message: "سبب الرفض مطلوب",
    path: ["rejectionReason"],
  });
export type DecideFromEmailInput = z.infer<typeof decideFromEmailSchema>;

/**
 * Backs the confirmation page an approval email links to.
 *
 * Split from InvoicesController because the route shape is different: these are
 * keyed by a one-time token rather than an invoice id. The rules are the same
 * ones the in-app buttons obey — same permission, same service, same conditional
 * status guard — so the two paths cannot drift into disagreeing.
 *
 * GET only reads. Changing state on GET would let mail scanners and link
 * previews decide invoices nobody clicked.
 */
@ApiTags("invoices")
@Controller("invoices/actions")
export class InvoiceActionsController {
  constructor(private readonly service: InvoicesService) {}

  /**
   * Public: the token identifies the manager, so no session is required.
   *
   * This deliberately trusts the mailbox — the same trust the password-reset
   * link already places in it, and a smaller one, since this can only decide a
   * single invoice rather than take over an account. What it does not do is act
   * on being fetched: mail scanners and link previews follow every URL in every
   * message, and a GET that decided would approve invoices nobody clicked.
   *
   * Throttled per IP because there is no login to slow anyone down, though the
   * token itself is 256 bits and not worth guessing.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":token")
  preview(@Param("token") token: string) {
    return this.service.previewTokenAction(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":token/decide")
  @HttpCode(200)
  decide(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(decideFromEmailSchema)) dto: DecideFromEmailInput,
  ) {
    return this.service.decideFromToken(token, dto);
  }
}
