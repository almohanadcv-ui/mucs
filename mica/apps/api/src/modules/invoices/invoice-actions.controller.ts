import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
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

  @Get(":token")
  @Permissions("invoices:view")
  preview(@Param("token") token: string, @CurrentUser() user: RequestUser) {
    return this.service.previewTokenAction(token, user.id);
  }

  @Post(":token/decide")
  @Permissions("invoices:approve")
  decide(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(decideFromEmailSchema)) dto: DecideFromEmailInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decideFromToken(token, dto, user.id);
  }
}
