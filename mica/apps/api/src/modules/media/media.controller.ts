import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";
import {
  listAttachmentsQuerySchema,
  uploadAttachmentBodySchema,
  type ListAttachmentsQuery,
  type UploadAttachmentBody,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { MediaService } from "./media.service";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
  "text/csv",
]);

@ApiTags("media")
@Controller("media")
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Get()
  @Permissions("media:view")
  list(@Query(new ZodValidationPipe(listAttachmentsQuerySchema)) query: ListAttachmentsQuery) {
    return this.service.listByEntity(query.entityType, query.entityId);
  }

  @Post("upload")
  @Permissions("media:create")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const allowed =
          ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix)) ||
          ALLOWED_MIME_TYPES.has(file.mimetype);
        callback(allowed ? null : new BadRequestException("Unsupported file type"), allowed);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadAttachmentBodySchema)) body: UploadAttachmentBody,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file provided");
    return this.service.upload(body.entityType, body.entityId, file, user.id, body.documentType);
  }

  @Delete(":id")
  @Permissions("media:delete")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  // Files are served by an unguessable UUID-based key rather than an
  // authenticated request, since <img>/<video> tags can't attach Bearer
  // headers. Revisit with signed URLs if stricter access control is needed.
  @Public()
  @Get("file/*")
  async serve(@Param("0") key: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.service.getFile(key);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(buffer);
  }
}
