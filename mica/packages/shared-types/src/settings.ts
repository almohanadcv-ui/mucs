import { z } from "zod";

export const companySettingsSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  taxId: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().optional(),
  currency: z.string().length(3).default("SAR"),
  timezone: z.string().min(1).default("Asia/Riyadh"),
});
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

/** `password` left blank on update keeps the previously stored credential. */
export const smtpSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  username: z.string().max(200).optional().or(z.literal("")),
  password: z.string().max(500).optional().or(z.literal("")),
  fromName: z.string().min(1).max(200),
  fromAddress: z.string().email(),
});
export type SmtpSettingsInput = z.infer<typeof smtpSettingsSchema>;

export const themeSettingsSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  defaultMode: z.enum(["light", "dark", "system"]).default("system"),
  defaultLocale: z.enum(["en", "ar"]).default("en"),
});
export type ThemeSettingsInput = z.infer<typeof themeSettingsSchema>;
