import { z } from "zod";

export const createSavedFilterSchema = z.object({
  name: z.string().min(1),
  module: z.string().min(1),
  filterJson: z.record(z.string(), z.unknown()),
  isShared: z.boolean().default(false),
});
export type CreateSavedFilterInput = z.infer<typeof createSavedFilterSchema>;
