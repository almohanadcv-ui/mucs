import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createApiKeySchema, type CreateApiKeyInput } from "@mica-mab/shared-types";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import type { RequestUser } from "@/modules/auth/types/request-user.type";
import { ApiKeyAuthGuard, type RequestWithApiKey } from "./api-key-auth.guard";
import { ApiKeysService } from "./api-keys.service";

@ApiTags("api-keys")
@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @Permissions("api-keys:view")
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions("api-keys:create")
  create(
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Post(":id/revoke")
  @Permissions("api-keys:revoke")
  @HttpCode(204)
  async revoke(@Param("id") id: string): Promise<void> {
    await this.service.revoke(id);
  }

  /** Demonstrates the machine-to-machine auth path: authenticate via x-api-key instead of a JWT. */
  @Get("whoami")
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  whoami(@Req() request: RequestWithApiKey) {
    return { apiKeyId: request.apiKey?.id, scopes: request.apiKey?.scopes };
  }
}
