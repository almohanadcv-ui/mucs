import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { createDriverReportSchema, type CreateDriverReportInput } from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { DriverPortalService } from "./driver-portal.service";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];

@ApiTags("driver-portal")
@Controller("driver-portal")
export class DriverPortalController {
  constructor(private readonly service: DriverPortalService) {}

  @Get("vehicles")
  @Permissions("driver-portal:view-vehicles")
  listVehicles(@CurrentUser() user: RequestUser) {
    return this.service.listVehicles(user.id);
  }

  @Get("reports")
  @Permissions("driver-portal:view-own-reports")
  listReports(@CurrentUser() user: RequestUser) {
    return this.service.listReports(user.id);
  }

  @Get("reports/:id")
  @Permissions("driver-portal:view-own-reports")
  getReport(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.getReport(user.id, id);
  }

  @Post("reports")
  @Permissions("driver-portal:create-report")
  createReport(
    @Body(new ZodValidationPipe(createDriverReportSchema)) body: CreateDriverReportInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createReport(user.id, body);
  }

  @Post("reports/:id/media")
  @Permissions("driver-portal:upload-media")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
        callback(allowed ? null : new BadRequestException("Only images and videos are allowed"), allowed);
      },
    }),
  )
  async uploadMedia(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file provided");
    return this.service.uploadMedia(user.id, id, file);
  }
}
