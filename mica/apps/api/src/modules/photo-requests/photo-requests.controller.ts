import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { createPhotoRequestSchema, type CreatePhotoRequestInput } from "./dto";
import { PhotoRequestsService } from "./photo-requests.service";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];

@ApiTags("photo-requests")
@Controller("photo-requests")
export class PhotoRequestsController {
  constructor(private readonly service: PhotoRequestsService) {}

  /** Mechanic / Manager: ask the vehicle's driver to photograph the meters. */
  @Post()
  @Permissions("vehicles:update")
  create(
    @Body(new ZodValidationPipe(createPhotoRequestSchema)) body: CreatePhotoRequestInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  /** Mechanic / Manager: all photo requests. */
  @Get()
  @Permissions("vehicles:view")
  listAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.service.listAll(Number(page) || 1, Number(pageSize) || 30);
  }

  /** Driver: my incoming photo requests. */
  @Get("mine")
  @Permissions("driver-portal:view-own-reports")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.listForDriver(user.id);
  }

  /** Driver: reply to a request with photos (+ optional note). */
  @Post(":id/reply")
  @Permissions("driver-portal:create-report")
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const allowed = ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p));
        callback(allowed ? null : new BadRequestException("يُسمح بالصور والفيديو فقط"), allowed);
      },
    }),
  )
  reply(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("note") note: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reply(user.id, id, files, note);
  }
}
