import { z } from "zod";

/** Mechanic/Manager asks a vehicle's driver to photograph the meters. */
export const createPhotoRequestSchema = z.object({
  vehicleId: z.string().min(1),
  message: z.string().trim().min(1).max(500).default("يرجى تصوير العدادات"),
});
export type CreatePhotoRequestInput = z.infer<typeof createPhotoRequestSchema>;

/** Driver's reply metadata (photos are uploaded as multipart files). */
export const replyPhotoRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});
export type ReplyPhotoRequestInput = z.infer<typeof replyPhotoRequestSchema>;
