import type { EntityTypeValue } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface AttachmentItem {
  id: string;
  entityType: string;
  entityId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO";
  thumbnailKey: string | null;
  documentType: string | null;
  createdAt: string;
}

export async function listAttachments(entityType: EntityTypeValue, entityId: string) {
  const { data } = await apiClient.get<AttachmentItem[]>("/media", {
    params: { entityType, entityId },
  });
  return data;
}

export async function uploadAttachment(
  entityType: EntityTypeValue,
  entityId: string,
  file: File,
  documentType?: string,
) {
  const form = new FormData();
  form.append("entityType", entityType);
  form.append("entityId", entityId);
  if (documentType) form.append("documentType", documentType);
  form.append("file", file);

  const { data } = await apiClient.post<AttachmentItem>("/media/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteAttachment(id: string) {
  await apiClient.delete(`/media/${id}`);
}

export function attachmentFileUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return `${base}/media/file/${key}`;
}
