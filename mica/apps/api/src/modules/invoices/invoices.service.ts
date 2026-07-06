import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
            title: "New invoice pending approval",
            body: `An invoice of ${invoice.amount} for vehicle ${vehicle.plateNumber} needs review.`,
            payload: { invoiceId: invoice.id, vehicleId: vehicle.id },
            channels: ["IN_APP", "EMAIL"],
          }),
        ),
    );

    return invoice;
  }

  async accept(id: string, dto: AcceptInvoiceInput, actingUserId: string) {
    await this.assertPending(id);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        decisionNotes: dto.notes,
        rejectionReason: null,
        decidedById: actingUserId,
        decidedAt: new Date(),
        updatedById: actingUserId,
      },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });
    await this.notifyCreator(updated, "accepted");
    return updated;
  }

  async reject(id: string, dto: RejectInvoiceInput, actingUserId: string) {
    await this.assertPending(id);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: dto.rejectionReason,
        decisionNotes: dto.notes,
        decidedById: actingUserId,
        decidedAt: new Date(),
        updatedById: actingUserId,
      },
      include: { vehicle: { select: { id: true, plateNumber: true, name: true } } },
    });
    await this.notifyCreator(updated, "rejected");
    return updated;
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

  private async assertPending(id: string) {
    const invoice = await this.findById(id);
    if (invoice.status !== "PENDING") {
      throw new ConflictException(`Invoice is already ${invoice.status.toLowerCase()}`);
    }
    return invoice;
  }

  private async notifyCreator(
    invoice: { id: string; createdById: string | null; rejectionReason: string | null; vehicle: { plateNumber: string } },
    outcome: "accepted" | "rejected",
  ): Promise<void> {
    if (!invoice.createdById) return;
    await this.notifications.notify({
      recipientId: invoice.createdById,
      type: `invoice.${outcome}`,
      title: `Your invoice was ${outcome}`,
      body:
        outcome === "rejected"
          ? `Invoice for ${invoice.vehicle.plateNumber} was rejected: ${invoice.rejectionReason ?? ""}`
          : `Invoice for ${invoice.vehicle.plateNumber} was accepted.`,
      payload: { invoiceId: invoice.id },
      channels: ["IN_APP", "EMAIL"],
    });
  }
}
