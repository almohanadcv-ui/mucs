import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly permissionCache: PermissionCacheService,
    private readonly notifications: NotificationsService,
  ) {}

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

    const invoice = await this.prisma.invoice.create({
      data: {
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
      },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });

    // Fan out to everyone who can approve invoices (Management + Technical Support).
    const approverIds = await this.permissionCache.findUserIdsWithPermission("invoices:approve");
    await Promise.all(
      approverIds
        .filter((uid) => uid !== actingUserId)
        .map((recipientId) =>
          this.notifications.notify({
            recipientId,
            type: "invoice.submitted",
            title: "فاتورة جديدة بانتظار الاعتماد",
            body: `فاتورة بقيمة ${invoice.amount} ر.س للمركبة ${vehicle.plateNumber} تحتاج مراجعة.`,
            payload: { invoiceId: invoice.id, vehicleId: vehicle.id },
            // The invoice id alone is enough: an invoice is submitted once.
            idempotencyKey: `MICA_INVOICE_SUBMITTED:${invoice.id}`,
            correlationId: invoice.id,
            channels: ["IN_APP", "EMAIL"],
          }),
        ),
    );

    return invoice;
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
      createdById: string | null;
      rejectionReason: string | null;
      decidedAt: Date | null;
      vehicle: { plateNumber: string };
    },
    outcome: "accepted" | "rejected",
  ): Promise<void> {
    if (!invoice.createdById) return;
    await this.notifications.notify({
      recipientId: invoice.createdById,
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
