import { z } from "zod";

export const createSparePartSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  unitCost: z.coerce.number().min(0),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  reorderThreshold: z.coerce.number().int().min(0).default(0),
  branchId: z.string().min(1),
});
export type CreateSparePartInput = z.infer<typeof createSparePartSchema>;

export const updateSparePartSchema = createSparePartSchema.partial().omit({ sku: true, branchId: true });
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>;

export const consumeSparePartSchema = z.object({
  sparePartId: z.string().min(1),
  quantityUsed: z.coerce.number().int().min(1),
});
export type ConsumeSparePartInput = z.infer<typeof consumeSparePartSchema>;
