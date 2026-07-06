import { Controller, Delete, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { BackupService } from "./backup.service";

@ApiTags("backups")
@Controller("backups")
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get()
  @Permissions("backups:view")
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions("backups:create")
  create(@CurrentUser() user: RequestUser) {
    return this.service.create(user.id);
  }

  @Post(":id/restore")
  @Permissions("backups:restore")
  @HttpCode(202)
  async restore(@Param("id") id: string): Promise<void> {
    await this.service.restore(id);
  }

  @Get(":id/download")
  @Permissions("backups:export")
  async download(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const { buffer, fileName } = await this.service.download(id);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Delete(":id")
  @Permissions("backups:delete")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
