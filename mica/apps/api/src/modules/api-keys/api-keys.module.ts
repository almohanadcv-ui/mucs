import { Global, Module } from "@nestjs/common";
import { ApiKeyAuthGuard } from "./api-key-auth.guard";
import { ApiKeyScopeGuard } from "./api-key-scope.guard";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";

@Global()
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyAuthGuard, ApiKeyScopeGuard],
  exports: [ApiKeysService, ApiKeyAuthGuard, ApiKeyScopeGuard],
})
export class ApiKeysModule {}
