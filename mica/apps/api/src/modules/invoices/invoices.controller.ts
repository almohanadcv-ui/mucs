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
  INVOICE_ALLOWED_MIME_TYPES,
  acceptInvoiceSchema,
  createInvoiceSchema,
  rejectInvoiceSchema,
  type AcceptInvoiceInput,
  type CreateInvoiceInput,
  type RejectInvoiceInput,
} from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { InvoicesService } from "./invoices.service";

const MAX_INVOICE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set<string>(INVOICE_ALLOWED_MIME_TYPES);

@ApiTags("invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  @Permissions("invoices:view")
  list(@Query("vehicleId") vehicleId?: string, @Query("status") status?: string) {
    return this.service.list({ vehicleId, status });
  }

  // Declared before :id so "deleted" isn't captured as an id param.
  @Get("deleted")
  @Permissions("invoices:delete")
  listDeleted() {
    return this.service.listDeleted();
  }

  @Post(":id/restore")
  @Permissions("invoices:delete")
  restore(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.restore(id, user.id);
  }

  @Get(":id")
  @Permissions("invoices:view")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions("invoices:create")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_INVOICE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const ok = ALLOWED.has(file.mimetype);
        cb(ok ? null : new BadRequestException("Only PDF, PNG, and JPG invoices are allowed"), ok);
      },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("An invoice file is required");
    return this.service.create(body, file, user.id);
  }

  @Post(":id/accept")
  @Permissions("invoices:approve")
  accept(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(acceptInvoiceSchema)) body: AcceptInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.accept(id, body, user.id);
  }

  @Post(":id/reject")
  @Permissions("invoices:reject")
  reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rejectInvoiceSchema)) body: RejectInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reject(id, body, user.id);
  }

  @Delete(":id")
  @Permissions("invoices:delete")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.service.remove(id, user.id);
  }

  @Get(":id/file")
  @Permissions("invoices:view")
  async serve(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const { buffer, mimeType, fileName } = await this.service.getFile(id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  }
}
