import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LocalStorageProvider } from "./local-storage.provider";
import { STORAGE_PROVIDER } from "./storage-provider.interface";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      // STORAGE_DRIVER=s3 will select an S3StorageProvider implementing the
      // same IStorageProvider interface once one is added — no other call
      // site needs to change.
      useExisting: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
