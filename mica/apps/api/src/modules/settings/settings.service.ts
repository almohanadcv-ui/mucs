import { Injectable } from "@nestjs/common";
import type { CompanySettingsInput, SmtpSettingsInput, ThemeSettingsInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { decryptSecret, encryptSecret } from "@/common/crypto/secret-box";

export const SETTING_KEYS = {
  COMPANY: "company.profile",
  SMTP: "company.smtp",
  THEME: "company.theme",
} as const;

const DEFAULT_COMPANY: CompanySettingsInput = {
  name: "MICA MAB Fleet",
  currency: "SAR",
  timezone: "Asia/Riyadh",
};

const DEFAULT_THEME: ThemeSettingsInput = {
  defaultMode: "system",
  defaultLocale: "en",
};

/**
 * Read/write access to the key-value Setting table. General-purpose `get`/`set`
 * back other modules' own settings (e.g. the maintenance approval-tier
 * thresholds); the typed company/SMTP/theme accessors back the admin
 * Settings UI specifically.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown, category: string, updatedById?: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as never, updatedById },
      create: { key, value: value as never, category, updatedById },
    });
  }

  getCompany(): Promise<CompanySettingsInput> {
    return this.get(SETTING_KEYS.COMPANY, DEFAULT_COMPANY);
  }

  setCompany(dto: CompanySettingsInput, updatedById: string): Promise<void> {
    return this.set(SETTING_KEYS.COMPANY, dto, "company", updatedById);
  }

  /** Password is never returned to the client — callers must explicitly ask for it via getSmtpWithSecret. */
  async getSmtp(): Promise<Omit<SmtpSettingsInput, "password"> & { hasPassword: boolean }> {
    const stored = await this.get<SmtpSettingsInput | null>(SETTING_KEYS.SMTP, null);
    if (!stored) {
      return {
        host: "",
        port: 587,
        secure: false,
        username: "",
        fromName: "",
        fromAddress: "",
        hasPassword: false,
      };
    }
    const { password, ...rest } = stored;
    return { ...rest, hasPassword: Boolean(password) };
  }

  /**
   * Returns the SMTP settings with the password decrypted for use. Rows written
   * before encryption existed are returned as-is and are re-encrypted the next
   * time the settings are saved, so no backfill migration is needed.
   */
  async getSmtpWithSecret(): Promise<SmtpSettingsInput | null> {
    const stored = await this.get<SmtpSettingsInput | null>(SETTING_KEYS.SMTP, null);
    if (!stored?.password) return stored;
    return { ...stored, password: decryptSecret(stored.password) };
  }

  async setSmtp(dto: SmtpSettingsInput, updatedById: string): Promise<void> {
    // Blank password on update means "keep the existing secret".
    let password = dto.password;
    if (!password) {
      const existing = await this.getSmtpWithSecret();
      password = existing?.password ?? "";
    }
    // Encrypted at rest: this secret ends up in every database backup and
    // pg_dump, and it is the credential for the company's real mailbox.
    await this.set(
      SETTING_KEYS.SMTP,
      { ...dto, password: encryptSecret(password) },
      "company",
      updatedById,
    );
  }

  getTheme(): Promise<ThemeSettingsInput> {
    return this.get(SETTING_KEYS.THEME, DEFAULT_THEME);
  }

  setTheme(dto: ThemeSettingsInput, updatedById: string): Promise<void> {
    return this.set(SETTING_KEYS.THEME, dto, "company", updatedById);
  }
}
