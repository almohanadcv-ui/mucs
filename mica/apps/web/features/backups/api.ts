import { apiClient } from "@/lib/api-client";

export interface BackupItem {
  id: string;
  fileKey: string | null;
  sizeBytes: number | null;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  triggeredById: string | null;
  type: "MANUAL" | "SCHEDULED";
  restoredAt: string | null;
  createdAt: string;
}

export async function listBackups() {
  const { data } = await apiClient.get<BackupItem[]>("/backups");
  return data;
}

export async function createBackup() {
  const { data } = await apiClient.post<BackupItem>("/backups");
  return data;
}

export async function restoreBackup(id: string) {
  await apiClient.post(`/backups/${id}/restore`);
}

export async function deleteBackup(id: string) {
  await apiClient.delete(`/backups/${id}`);
}

export async function downloadBackup(id: string): Promise<void> {
  const { data } = await apiClient.get(`/backups/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mica-mab-backup-${id}.dump`;
  link.click();
  URL.revokeObjectURL(url);
}
