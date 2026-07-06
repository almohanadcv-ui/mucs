export interface SaveFileOptions {
  key: string;
  mimeType: string;
}

/**
 * Storage abstraction — local disk by default (LocalStorageProvider). Swapping
 * to S3 later means implementing this same interface (S3StorageProvider) and
 * changing STORAGE_DRIVER; no call site outside storage.module.ts changes.
 */
export interface IStorageProvider {
  save(buffer: Buffer, options: SaveFileOptions): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getServeUrl(key: string): string;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
