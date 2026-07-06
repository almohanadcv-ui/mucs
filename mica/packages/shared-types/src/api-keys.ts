import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string().min(1)).min(1),
  expiresAt: z.coerce.date().optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
