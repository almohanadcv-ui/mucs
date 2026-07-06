import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(120),
  code: z
    .string()
    .trim()
    .min(1, "الرمز مطلوب")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/u, "الرمز يقبل أحرف وأرقام و - _ فقط"),
  branchId: z.string().uuid().optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();
export const listDepartmentsSchema = paginationSchema.extend({
  branchId: z.string().uuid().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsInput = z.infer<typeof listDepartmentsSchema>;
