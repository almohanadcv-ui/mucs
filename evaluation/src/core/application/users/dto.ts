import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { Role } from "@/core/domain/enums";

const roleEnum = z.enum([Role.ADMIN, Role.SUPERVISOR, Role.EVALUATOR]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح"),
  // Omit the password to invite the user instead: they receive a link and set
  // their own password (mirrors MICA). When present it's set directly.
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(200).optional(),
  role: roleEnum,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح").optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export const listUsersSchema = paginationSchema.extend({
  role: roleEnum.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
