import { createHash, randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateApiKeyInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";

export interface ApiKeyPrincipal {
  id: string;
  scopes: string[];
  createdById: string | null;
}

/**
 * API keys are hashed with SHA-256 rather than argon2: the guard must find a
 * key by its raw value on every request, which requires a deterministic
 * lookup hash. A salted slow hash (argon2) can't support that without
 * iterating every stored key. This is safe here because the raw key itself
 * carries ~144 bits of entropy (crypto.randomBytes), unlike a user password.
 */
function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawKey(): { raw: string; prefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const raw = `mica_${secret}`;
  return { raw, prefix: raw.slice(0, 12) };
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdById: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Returns the raw key exactly once — it is never retrievable again after this call. */
  async create(dto: CreateApiKeyInput, createdById: string) {
    const { raw, prefix } = generateRawKey();
    const key = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt,
        prefix,
        keyHash: hashKey(raw),
        createdById,
      },
      select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, createdAt: true },
    });
    return { ...key, rawKey: raw };
  }

  async revoke(id: string): Promise<void> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException("API key not found");
    if (key.revokedAt) return;
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Validates a raw key from the `x-api-key` header. Used by ApiKeyAuthGuard on every request. */
  async authenticate(rawKey: string): Promise<ApiKeyPrincipal> {
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
    if (!key) throw new ForbiddenException("Invalid API key");
    if (key.revokedAt) throw new ForbiddenException("API key has been revoked");
    if (key.expiresAt && key.expiresAt < new Date()) throw new ForbiddenException("API key has expired");

    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { id: key.id, scopes: key.scopes, createdById: key.createdById };
  }
}
