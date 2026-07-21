import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type {
  AcceptInvoiceInput,
  CreateInvoiceInput,
  RejectInvoiceInput,
} from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { STORAGE_PROVIDER, type IStorageProvider } from "@/storage/storage-provider.interface";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import {
  invoiceDecidedEmail,
  invoiceSubmittedEmail,
} from "@/modules/notifications/templates/invoice.templates";
import { InvoiceActionTokenService } from "./invoice-action-token.service";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Undefined rather than a stray space when the user row is missing. */
function fullName(user: { firstName: string; lastName: string } | null): string | undefined {
  return user ? `${user.firstName} ${user.lastName}`.trim() : undefined;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly permissionCache: PermissionCacheService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly tokens: InvoiceActionTokenService,
  ) {}

  /** Base address for links that travel to an inbox. */
  private get publicUrl(): string {
    return this.config.get<string>("app.publicUrl") ?? "";
  }

  list(filters: { vehicleId?: string; status?: string }) {
    return this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });
  }

  async findById(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  async create(dto: CreateInvoiceInput, file: Express.Multer.File, actingUserId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    });
    if (!vehicle) throw new BadRequestException("Vehicle not found");

    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) throw new BadRequestException("Only PDF, PNG, and JPG invoices are allowed");

    const fileKey = `invoices/${dto.vehicleId}/${randomUUID()}.${ext}`;
    await this.storage.save(file.buffer, { key: fileKey, mimeType: file.mimetype });

    const invoice = await this.createNumbered({
      vehicleId: dto.vehicleId,
      amount: dto.amount,
      description: dto.description,
      workshopName: dto.workshopName,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
      fileKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      createdById: actingUserId,
    });

    const approverIds = await this.approversToNotify(actingUserId);
    const submitter = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { firstName: true, lastName: true },
    });
    await Promise.all(
      approverIds
        .map(async (recipientId) => {
          // A token per recipient, so the audit trail shows whose link was
          // followed and one manager's link cannot be reused by another.
          const actionToken = await this.tokens.issue(invoice.id, recipientId);
          const email = invoiceSubmittedEmail({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount.toString(),
            plateNumber: vehicle.plateNumber,
            vehicleName: vehicle.name,
            workshopName: invoice.workshopName,
            submittedBy: fullName(submitter),
            submittedAt: invoice.createdAt,
            publicUrl: this.publicUrl,
            actionToken,
          });
          // The file travels with the request so a manager can read the
          // invoice in their inbox instead of opening the site to see it.
          email.attachInvoiceId = invoice.id;

          return this.notifications.notify({
            recipientId,
            type: "invoice.submitted",
            title: "فاتورة جديدة بانتظار الاعتماد",
            body: `فاتورة بقيمة ${invoice.amount} ر.س للمركبة ${vehicle.plateNumber} تحتاج مراجعة.`,
            email,
            payload: { invoiceId: invoice.id, vehicleId: vehicle.id },
            // The invoice id alone is enough: an invoice is submitted once.
            idempotencyKey: `MICA_INVOICE_SUBMITTED:${invoice.id}`,
            correlationId: invoice.id,
            channels: ["IN_APP", "EMAIL"],
          });
        }),
    );

    return invoice;
  }

  /**
   * Who gets emailed when an invoice needs a decision.
   *
   * Approving is Management's job. Technical Support also holds
   * `invoices:approve`, but only because that role is granted every permission
   * by construction — being paged for every invoice is a side effect of being
   * super admin, not a statement that IT reviews spending. They keep the
   * ability to decide; they stop being notified about it.
   *
   * The uploader is dropped too: nobody needs an email about what they just did.
   */
  private async approversToNotify(actingUserId: string): Promise<string[]> {
    const approverIds = await this.permissionCache.findUserIdsWithPermission("invoices:approve");

    const superAdmins = await this.prisma.userRole.findMany({
      where: { role: { name: "Technical Support" } },
      select: { userId: true },
    });
    const superAdminIds = new Set(superAdmins.map((r) => r.userId));

    const management = approverIds.filter(
      (id) => id !== actingUserId && !superAdminIds.has(id),
    );

    // Nobody left — no Management account exists yet, or the only approvers are
    // super admins. Falling back to them beats an invoice sitting unseen
    // because the notification had no one to go to.
    if (management.length === 0) {
      const fallback = approverIds.filter((id) => id !== actingUserId);
      if (fallback.length > 0) {
        this.logger.warn(
          "No Management approver to notify; falling back to Technical Support",
        );
      }
      return fallback;
    }

    return management;
  }

  /**
   * Creates the invoice with the next number for the current year.
   *
   * The number is derived by reading the highest one issued, which two
   * simultaneous uploads can read identically. Rather than serialise every
   * upload behind a lock, this lets the unique index reject the loser and
   * retries — collisions are rare, and a retry costs less than the contention
   * a lock would add on the common path. Soft-deleted invoices still hold
   * their numbers, so a deletion never causes one to be reused.
   */
  private async createNumbered(data: Omit<Prisma.InvoiceUncheckedCreateInput, "invoiceNumber">) {
    const include = { vehicle: { select: { id: true, plateNumber: true, name: true } } };

    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNumber = await this.nextInvoiceNumber();
      try {
        return await this.prisma.invoice.create({ data: { ...data, invoiceNumber }, include });
      } catch (e) {
        const collided =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002" &&
          (e.meta?.target as string[] | undefined)?.includes("invoiceNumber");
        if (!collided) throw e;
        this.logger.warn(`Invoice number ${invoiceNumber} was taken; retrying`);
      }
    }
    throw new ConflictException("تعذّر إصدار رقم فاتورة، حاول مرة أخرى");
  }

  private async nextInvoiceNumber(): Promise<string> {
    const prefix = `INV-${new Date().getFullYear()}-`;
    // Zero-padded to a fixed width, so lexical ordering is numeric ordering.
    const last = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    const previous = last ? Number(last.invoiceNumber.slice(prefix.length)) : 0;
    return prefix + String(previous + 1).padStart(6, "0");
  }

  async accept(id: string, dto: AcceptInvoiceInput, actingUserId: string) {
    const updated = await this.decide(
      id,
      { status: "ACCEPTED", decisionNotes: dto.notes, rejectionReason: null },
      actingUserId,
    );
    await this.notifyCreator(updated, "accepted");
    return updated;
  }

  async reject(id: string, dto: RejectInvoiceInput, actingUserId: string) {
    const updated = await this.decide(
      id,
      {
        status: "REJECTED",
        rejectionReason: dto.rejectionReason,
        decisionNotes: dto.notes,
      },
      actingUserId,
    );
    await this.notifyCreator(updated, "rejected");
    return updated;
  }

  /**
   * Applies an accept/reject decision, but only if the invoice is still
   * PENDING at the moment of the write.
   *
   * This is a conditional update rather than a read-then-write: two managers
   * deciding at the same instant would both pass a separate status check and
   * both write, so the last one would silently overwrite the first and the
   * mechanic would receive two contradicting emails. Putting `status:
   * "PENDING"` in the WHERE clause makes the database itself the arbiter —
   * exactly one update matches a row, and the loser gets a 409 instead of a
   * false success. No transaction or version column is needed: a single
   * conditional UPDATE is already atomic.
   */
  private async decide(
    id: string,
    decision: Prisma.InvoiceUpdateManyMutationInput,
    actingUserId: string,
  ) {
    const { count } = await this.prisma.invoice.updateMany({
      where: { id, status: "PENDING", deletedAt: null },
      data: { ...decision, decidedById: actingUserId, decidedAt: new Date(), updatedById: actingUserId },
    });

    // Nothing matched: either the invoice is gone or somebody decided first.
    // findById distinguishes the two and raises the same errors this method
    // raised before, so callers and the API contract are unchanged.
    if (count === 0) {
      const existing = await this.findById(id);
      throw new ConflictException(`Invoice is already ${existing.status.toLowerCase()}`);
    }

    return this.findById(id);
  }

  /**
   * What the confirmation page shows before anything is decided. Read-only by
   * design: following the link must never change state.
   *
   * The token is not treated as proof of identity — the caller is already
   * authenticated, and this only reports whether their session may act on the
   * invoice the token names. A link forwarded to a colleague without the
   * permission opens to a refusal, not to a live form.
   */
  async previewTokenAction(token: string, actingUserId: string) {
    const claims = await this.tokens.peek(token);
    if (typeof claims === "string") return { state: claims } as const;

    const invoice = await this.findById(claims.invoiceId);
    const canDecide =
      invoice.status === "PENDING" &&
      (await this.permissionCache.findUserIdsWithPermission("invoices:approve")).includes(
        actingUserId,
      );

    const submitter = invoice.createdById
      ? await this.prisma.user.findUnique({
          where: { id: invoice.createdById },
          select: { firstName: true, lastName: true },
        })
      : null;

    return {
      state: canDecide ? ("actionable" as const) : ("decided" as const),
      // Addressed to someone else: shown, but flagged, so the page can say so
      // rather than pretending the link was theirs.
      addressedToSomeoneElse: claims.userId !== actingUserId,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: invoice.amount.toString(),
        workshopName: invoice.workshopName,
        rejectionReason: invoice.rejectionReason,
        createdAt: invoice.createdAt,
        submittedBy: fullName(submitter) ?? null,
        vehicle: invoice.vehicle,
      },
    };
  }

  /**
   * Applies a decision made from an email link.
   *
   * Routes through the same accept/reject the in-app buttons use, so the
   * conditional status guard, the audit trail and the mechanic's notification
   * are identical no matter where the click came from. The token is consumed
   * first: consuming is itself a conditional update, so a double-submitted form
   * is stopped before any invoice is touched.
   */
  async decideFromToken(
    token: string,
    dto: { decision: "approve" | "reject"; rejectionReason?: string },
    actingUserId: string,
  ) {
    const claims = await this.tokens.peek(token);
    if (typeof claims === "string") {
      throw new ConflictException(
        claims === "expired"
          ? "انتهت صلاحية هذا الرابط. افتح الفاتورة من داخل النظام."
          : "هذا الرابط استُخدم من قبل أو لم يعد صالحًا.",
      );
    }

    if (!(await this.tokens.consume(token))) {
      throw new ConflictException("هذا الرابط استُخدم من قبل.");
    }

    const decided =
      dto.decision === "approve"
        ? await this.accept(claims.invoiceId, {} as AcceptInvoiceInput, actingUserId)
        : await this.reject(
            claims.invoiceId,
            { rejectionReason: dto.rejectionReason } as RejectInvoiceInput,
            actingUserId,
          );

    // Every other manager's link for this invoice is now stale.
    await this.tokens.revokeForInvoice(claims.invoiceId);
    return decided;
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    const invoice = await this.findById(id);
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { deletedAt: new Date(), updatedById: actingUserId },
    });
  }

  listDeleted() {
    return this.prisma.invoice.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });
  }

  async restore(id: string, actingUserId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || !invoice.deletedAt) throw new NotFoundException("Deleted invoice not found");
    return this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: null, updatedById: actingUserId },
    });
  }

  async getFile(id: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const invoice = await this.findById(id);
    const buffer = await this.storage.read(invoice.fileKey);
    return { buffer, mimeType: invoice.mimeType, fileName: invoice.fileName };
  }

  private async notifyCreator(
    invoice: {
      id: string;
      invoiceNumber: string;
      createdById: string | null;
      decidedById: string | null;
      rejectionReason: string | null;
      decidedAt: Date | null;
      amount: Prisma.Decimal;
      vehicle: { plateNumber: string; name: string | null };
    },
    outcome: "accepted" | "rejected",
  ): Promise<void> {
    if (!invoice.createdById) {
      // Worth seeing: an invoice with no recorded uploader means nobody is
      // told the outcome, and that is a data problem, not a quiet no-op.
      this.logger.warn(`Invoice ${invoice.id} has no createdById; skipping decision email`);
      return;
    }

    const decider = invoice.decidedById
      ? await this.prisma.user.findUnique({
          where: { id: invoice.decidedById },
          select: { firstName: true, lastName: true },
        })
      : null;

    const email = invoiceDecidedEmail({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount.toString(),
      plateNumber: invoice.vehicle.plateNumber,
      vehicleName: invoice.vehicle.name,
      submittedAt: invoice.decidedAt ?? new Date(),
      publicUrl: this.publicUrl,
      outcome,
      decidedBy: fullName(decider),
      decidedAt: invoice.decidedAt ?? new Date(),
      rejectionReason: invoice.rejectionReason,
    });

    await this.notifications.notify({
      recipientId: invoice.createdById,
      email,
      // decidedAt is part of the key so a later, legitimate second decision
      // (after a restore, say) is announced rather than swallowed as a
      // duplicate — while a retry of the same decision is not.
      idempotencyKey: `MICA_INVOICE_${outcome.toUpperCase()}:${invoice.id}:${invoice.decidedAt?.toISOString() ?? ""}`,
      correlationId: invoice.id,
      type: `invoice.${outcome}`,
      title: outcome === "rejected" ? "تم رفض فاتورتك" : "تم قبول فاتورتك",
      body:
        outcome === "rejected"
          ? `فاتورة المركبة ${invoice.vehicle.plateNumber} مرفوضة: ${invoice.rejectionReason ?? ""}`
          : `فاتورة المركبة ${invoice.vehicle.plateNumber} تم قبولها.`,
      payload: { invoiceId: invoice.id },
      channels: ["IN_APP", "EMAIL"],
    });
  }
}
