"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { createBackup, deleteBackup, downloadBackup, listBackups, type BackupItem } from "@/features/backups/api";
import { RestoreConfirmDialog } from "@/features/backups/restore-confirm-dialog";

const STATUS_VARIANT = {
  COMPLETED: "secondary",
  IN_PROGRESS: "outline",
  FAILED: "destructive",
} as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const canCreate = usePermission("backups:create");
  const canRestore = usePermission("backups:restore");
  const canExport = usePermission("backups:export");
  const canDelete = usePermission("backups:delete");
  const queryClient = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: listBackups,
    refetchInterval: (query) =>
      query.state.data?.some((b: BackupItem) => b.status === "IN_PROGRESS") ? 2000 : false,
  });

  const createMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      toast.success("Backup created");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Backup failed"
        : "Backup failed";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      toast.success("Backup deleted");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: () => toast.error("Failed to delete backup"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
          <p className="text-muted-foreground">
            On-demand PostgreSQL dumps via pg_dump, restorable via pg_restore.
          </p>
        </div>
        {canCreate && (
          <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Backing up…" : "Back up now"}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Restored</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No backups yet.
                </TableCell>
              </TableRow>
            )}

            {data?.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell className="font-medium">
                  {new Date(backup.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[backup.status]}>{backup.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatSize(backup.sizeBytes)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {backup.restoredAt ? new Date(backup.restoredAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    {canExport && backup.status === "COMPLETED" && (
                      <Button size="sm" variant="ghost" onClick={() => downloadBackup(backup.id)}>
                        Download
                      </Button>
                    )}
                    {canRestore && backup.status === "COMPLETED" && (
                      <Button size="sm" variant="ghost" onClick={() => setRestoreTarget(backup.id)}>
                        Restore
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(backup.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RestoreConfirmDialog
        backupId={restoreTarget}
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      />
    </div>
  );
}
