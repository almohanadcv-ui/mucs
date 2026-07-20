import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { inferAttachmentKind, type EntityTypeValue } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { STORAGE_PROVIDER, type IStorageProvider } from "@/storage/storage-provider.interface";

const THUMBNAIL_WIDTH = 320;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  async upload(
    entityType: EntityTypeValue,
    entityId: string,
    file: Express.Multer.File,
    uploadedById: string,
    documentType?: string,
  ) {
    const kind = inferAttachmentKind(file.mimetype);
    const extension = file.originalname.includes(".") ? file.originalname.split(".").pop() : undefined;
    const baseKey = `${entityType.toLowerCase()}/${entityId}/${randomUUID()}`;
    const fileKey = extension ? `${baseKey}.${extension}` : baseKey;

    // Logged for every upload: when a device-specific problem is reported
    // ("works on laptop, fails on iPad"), these are the facts that identify it —
    // the type and size the device actually sent.
    const sizeKb = Math.round(file.size / 1024);
    this.logger.log(
      `Upload received: name="${file.originalname}" type=${file.mimetype} size=${sizeKb}KB ` +
        `entity=${entityType}/${entityId} by=${uploadedById}`,
    );

    try {
      await this.storage.save(file.buffer, { key: fileKey, mimeType: file.mimetype });
    } catch (error) {
      this.logger.error(
        `Upload FAILED to store: name="${file.originalname}" type=${file.mimetype} ` +
          `size=${sizeKb}KB — ${(error as Error).message}`,
      );
      throw error;
    }

    let thumbnailKey: string | undefined;
    if (kind === "IMAGE") {
      try {
        const thumbnailBuffer = await sharp(file.buffer)
          .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        thumbnailKey = `${baseKey}-thumb.jpg`;
        await this.storage.save(thumbnailBuffer, { key: thumbnailKey, mimeType: "image/jpeg" });
      } catch (error) {
        // The original is already stored, so a thumbnail failure must not fail
        // the upload — but it is recorded, because it is the signal that a
        // phone format (e.g. HEIC from an iPhone/iPad) needs converting.
        this.logger.warn(
          `Thumbnail skipped for "${file.originalname}" (${file.mimetype}): ${(error as Error).message}`,
        );
        thumbnailKey = undefined;
      }
    }

    return this.prisma.attachment.create({
      data: {
        entityType,
        entityId,
        fileKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind,
        thumbnailKey,
        documentType,
        uploadedById,
      },
    });
  }

  listByEntity(entityType: EntityTypeValue, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { entityType, entityId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw new NotFoundException("Attachment not found");

    await this.storage.delete(attachment.fileKey);
    if (attachment.thumbnailKey) await this.storage.delete(attachment.thumbnailKey);

    await this.prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getFile(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { OR: [{ fileKey: key }, { thumbnailKey: key }], deletedAt: null },
    });
    if (!attachment) throw new NotFoundException("File not found");

    const buffer = await this.storage.read(key);
    const mimeType = key === attachment.thumbnailKey ? "image/jpeg" : attachment.mimeType;
    return { buffer, mimeType };
  }
}
