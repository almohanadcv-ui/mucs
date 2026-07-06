import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import type { IStorageProvider, SaveFileOptions } from "./storage-provider.interface";

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(this.config.get<string>("storage.local.root") ?? "./storage");
  }

  async save(buffer: Buffer, options: SaveFileOptions): Promise<void> {
    const path = this.resolveKeyPath(options.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKeyPath(key), { force: true });
  }

  getServeUrl(key: string): string {
    return `/media/file/${key}`;
  }

  /** Resolves a storage key to an on-disk path, rejecting traversal outside the storage root. */
  private resolveKeyPath(key: string): string {
    const path = resolve(join(this.root, normalize(key)));
    if (!path.startsWith(this.root)) {
      throw new Error("Invalid storage key");
    }
    return path;
  }
}
