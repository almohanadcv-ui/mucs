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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "رابط غير صالح"),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(200),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}
