"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { restoreBackup } from "./api";

export function RestoreConfirmDialog({
  backupId,
  open,
  onOpenChange,
}: {
  backupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: () => {
      toast.success("Database restored from backup");
      queryClient.invalidateQueries();
      onOpenChange(false);
      setConfirmText("");
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Restore failed"
        : "Restore failed";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore this backup?</DialogTitle>
          <DialogDescription>
            This overwrites the entire current database with the contents of this backup. Any
            data created since this snapshot will be permanently lost. Type{" "}
            <code className="font-semibold">RESTORE</code> to confirm.
          </DialogDescription>
        </DialogHeader>
        <input
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESTORE"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={confirmText !== "RESTORE" || mutation.isPending || !backupId}
            onClick={() => backupId && mutation.mutate(backupId)}
          >
            {mutation.isPending ? "Restoring…" : "Restore and overwrite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
