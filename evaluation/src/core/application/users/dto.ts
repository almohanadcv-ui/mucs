import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { Role } from "@/core/domain/enums";

const roleEnum = z.enum([Role.ADMIN, Role.SUPERVISOR, Role.EVALUATOR]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح"),
  password: z.string().min(12, "كلمة المرور 12 حرفاً على الأقل").max(200),
  role: roleEnum,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(200).optional(),
});

export const listUsersSchema = paginationSchema.extend({
  role: roleEnum.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
