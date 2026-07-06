import { join } from "node:path";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/database/prisma/prisma.service";
import { STORAGE_PROVIDER, type IStorageProvider } from "@/storage/storage-provider.interface";

interface DbConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Shells out to pg_dump/pg_restore rather than reimplementing logical
 * dump/restore: they already handle schema + data + extensions correctly,
 * and reinventing that in application code would be both slower and less
 * reliable than the tools Postgres ships for exactly this purpose.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  list() {
    return this.prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(triggeredById: string) {
    const record = await this.prisma.backupRecord.create({
      data: { type: "MANUAL", status: "IN_PROGRESS", triggeredById },
    });

    try {
      const buffer = await this.runPgDump();
      const fileKey = `backups/${record.id}-${randomUUID()}.dump`;
      await this.storage.save(buffer, { key: fileKey, mimeType: "application/octet-stream" });

      return this.prisma.backupRecord.update({
        where: { id: record.id },
        data: { status: "COMPLETED", fileKey, sizeBytes: buffer.byteLength },
      });
    } catch (error) {
      this.logger.error(`Backup ${record.id} failed: ${(error as Error).message}`);
      await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: { status: "FAILED" },
      });
      throw new InternalServerErrorException("Backup failed — see server logs for details");
    }
  }

  async restore(id: string): Promise<void> {
    const record = await this.findOrThrow(id);
    if (record.status !== "COMPLETED" || !record.fileKey) {
      throw new BadRequestException("Only a completed backup with a stored file can be restored");
    }

    const buffer = await this.storage.read(record.fileKey);
    await this.runPgRestore(buffer);

    await this.prisma.backupRecord.update({ where: { id }, data: { restoredAt: new Date() } });
  }

  async download(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const record = await this.findOrThrow(id);
    if (!record.fileKey) throw new BadRequestException("This backup has no stored file");
    const buffer = await this.storage.read(record.fileKey);
    return { buffer, fileName: `mica-mab-backup-${record.createdAt.toISOString().slice(0, 10)}-${record.id}.dump` };
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOrThrow(id);
    if (record.fileKey) await this.storage.delete(record.fileKey);
    await this.prisma.backupRecord.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const record = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Backup not found");
    return record;
  }

  private parseConnection(): DbConnection {
    const url = new URL(this.config.get<string>("database.url") ?? "");
    return {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
    };
  }

  private binPath(name: string): string {
    const dir = this.config.get<string>("backup.pgBinDir") ?? "";
    const exe = platform() === "win32" ? `${name}.exe` : name;
    return dir ? join(dir, exe) : exe;
  }

  private runPgDump(): Promise<Buffer> {
    const conn = this.parseConnection();
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.binPath("pg_dump"),
        ["-h", conn.host, "-p", conn.port, "-U", conn.user, "-d", conn.database, "-Fc"],
        { env: { ...process.env, PGPASSWORD: conn.password } },
      );

      const chunks: Buffer[] = [];
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`));
      });
    });
  }

  private runPgRestore(buffer: Buffer): Promise<void> {
    const conn = this.parseConnection();
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.binPath("pg_restore"),
        ["-h", conn.host, "-p", conn.port, "-U", conn.user, "-d", conn.database, "--clean", "--if-exists", "--no-owner"],
        { env: { ...process.env, PGPASSWORD: conn.password } },
      );

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_restore exited with code ${code}: ${stderr.trim()}`));
      });

      child.stdin.write(buffer);
      child.stdin.end();
    });
  }
}
