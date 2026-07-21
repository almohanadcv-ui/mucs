import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyTwoFactorSchema = z.object({
  challengeId: z.string().min(1),
  // Exactly six digits: anything else is a typo, and rejecting it here spares
  // the challenge one of its five attempts.
  code: z.string().regex(/^\d{6}$/, "الرمز مكوّن من ٦ أرقام"),
});
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateOwnProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
});
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  branchId: string | null;
  departmentId: string | null;
  roles: string[];
  permissions: string[];
}

export type LoginResponse =
  | {
      accessToken: string;
      user: AuthUser;
      mustChangePassword?: false;
    }
  | {
      mustChangePassword: true;
      passwordResetToken: string;
      user: Pick<AuthUser, "id" | "email" | "firstName" | "lastName" | "status">;
    }
  // The password was right, but a code was emailed and no session exists yet.
  | {
      requiresTwoFactor: true;
      challengeId: string;
    };
