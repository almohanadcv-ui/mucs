import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { MediaService } from "@/modules/media/media.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import type { CreatePhotoRequestInput } from "./dto";

@Injectable()
export class PhotoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Mechanic/Manager → the vehicle's current driver. */
  async create(dto: CreatePhotoRequestInput, actorId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
      select: { id: true, plateNumber: true, currentDriverId: true },
    });
    if (!vehicle) throw new NotFoundException("المركبة غير موجودة");
    if (!vehicle.currentDriverId) throw new BadRequestException("لا يوجد سائق مرتبط بهذه المركبة");

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true, email: true },
    });
    const requestedByName = actor
      ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email
      : null;

    const request = await this.prisma.driverPhotoRequest.create({
      data: {
        vehicleId: vehicle.id,
        driverId: vehicle.currentDriverId,
        requestedById: actorId,
        requestedByName,
        message: dto.message,
      },
    });

    const driver = await this.prisma.driver.findUnique({
      where: { id: vehicle.currentDriverId },
      select: { userId: true },
    });
    if (driver?.userId) {
      await this.notifications.notify({
        recipientId: driver.userId,
        type: "photo_request.created",
        title: "طلب تصوير جديد",
        body: `الرجاء تصوير العدادات للمركبة ${vehicle.plateNumber}: ${dto.message}`,
        payload: { photoRequestId: request.id },
        channels: [NotificationChannel.IN_APP],
      });
    }
    return request;
  }

  /** All requests — for mechanics/managers. */
  async listAll(page = 1, pageSize = 30) {
    const [items, totalItems] = await Promise.all([
      this.prisma.driverPhotoRequest.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.driverPhotoRequest.count(),
    ]);
    return {
      items,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  }

  /** Every photo request for one vehicle, each with its reply photos — so the
   *  mechanic can see whether/what the driver sent back. */
  async listForVehicle(vehicleId: string) {
    const items = await this.prisma.driverPhotoRequest.findMany({
      where: { vehicleId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      items.map(async (r) => ({
        ...r,
        attachments: await this.media.listByEntity("DRIVER_PHOTO_REQUEST", r.id),
      })),
    );
  }

  private async driverForUser(userId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!driver) throw new ForbiddenException("لا يوجد ملف سائق مرتبط بحسابك");
    return driver;
  }

  /** The signed-in driver's own incoming requests (+ any reply photos). */
  async listForDriver(userId: string) {
    const driver = await this.driverForUser(userId);
    const items = await this.prisma.driverPhotoRequest.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      items.map(async (r) => ({
        ...r,
        attachments: await this.media.listByEntity("DRIVER_PHOTO_REQUEST", r.id),
      })),
    );
  }

  /** Driver replies with photos (+ optional note); notifies the requester. */
  async reply(userId: string, id: string, files: Express.Multer.File[], note?: string) {
    const driver = await this.driverForUser(userId);
    const request = await this.prisma.driverPhotoRequest.findFirst({
      where: { id, driverId: driver.id },
    });
    if (!request) throw new NotFoundException("الطلب غير موجود");
    if (!files?.length) throw new BadRequestException("أرفق صورة واحدة على الأقل");

    for (const file of files) {
      await this.media.upload("DRIVER_PHOTO_REQUEST", id, file, userId);
    }

    const updated = await this.prisma.driverPhotoRequest.update({
      where: { id },
      data: { status: "ANSWERED", answeredAt: new Date(), replyNote: note ?? request.replyNote },
    });

    await this.notifications.notify({
      recipientId: request.requestedById,
      type: "photo_request.answered",
      title: "ردّ السائق بالصور",
      body: "قام السائق بإرفاق صور العدادات المطلوبة.",
      payload: { photoRequestId: id },
      channels: [NotificationChannel.IN_APP],
    });
    return updated;
  }
}
