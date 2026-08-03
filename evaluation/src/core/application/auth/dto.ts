import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  // Optional 6-digit TOTP when 2FA is enabled on the account
  totp: z
    .string()
    .regex(/^\d{6}$/u, "رمز التحقق يجب أن يكون 6 أرقام")
    .optional(),
  tenantSlug: z.string().trim().min(1).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verifyChallengeSchema = z.object({
  challengeId: z.string().uuid("طلب غير صالح"),
  code: z.string().regex(/^\d{6}$/u, "الرمز يجب أن يكون 6 أرقام"),
});

export type VerifyChallengeInput = z.infer<typeof verifyChallengeSchema>;

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}
