import { z } from "zod";

export const ENTITY_TYPES = ["VEHICLE", "DRIVER", "MAINTENANCE_REQUEST", "APPOINTMENT"] as const;
export type EntityTypeValue = (typeof ENTITY_TYPES)[number];

export const ATTACHMENT_KINDS = ["IMAGE", "VIDEO", "DOCUMENT", "AUDIO"] as const;
export type AttachmentKindValue = (typeof ATTACHMENT_KINDS)[number];

export const listAttachmentsQuerySchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
});
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;

export const uploadAttachmentBodySchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  documentType: z.string().optional(),
});
export type UploadAttachmentBody = z.infer<typeof uploadAttachmentBodySchema>;

export function inferAttachmentKind(mimeType: string): AttachmentKindValue {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}
