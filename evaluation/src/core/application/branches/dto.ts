import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(120),
  code: z
    .string()
    .trim()
    .min(1, "الرمز مطلوب")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/u, "الرمز يقبل أحرف وأرقام و - _ فقط"),
  address: z.string().trim().max(255).optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const listBranchesSchema = paginationSchema;

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
