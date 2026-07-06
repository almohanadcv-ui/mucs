"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import type { EntityTypeValue } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  attachmentFileUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@/features/media/api";

interface MediaGalleryProps {
  entityType: EntityTypeValue;
  entityId: string;
  canUpload: boolean;
  canDelete: boolean;
}

export function MediaGallery({ entityType, entityId, canUpload, canDelete }: MediaGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const queryKey = ["attachments", entityType, entityId];
  const { data: attachments, isLoading } = useQuery({
    queryKey,
    queryFn: () => listAttachments(entityType, entityId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(entityType, entityId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Failed to delete file"),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag &amp; drop files here, or{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      )}

      {!isLoading && attachments?.length === 0 && (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {attachments?.map((attachment) => (
          <div key={attachment.id} className="group relative aspect-square overflow-hidden rounded-md border">
            <a
              href={attachmentFileUrl(attachment.fileKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center bg-muted"
            >
              {attachment.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachmentFileUrl(attachment.thumbnailKey ?? attachment.fileKey)}
                  alt={attachment.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileText className="size-8 text-muted-foreground" />
              )}
            </a>
            <p className="truncate bg-background/80 px-1.5 py-0.5 text-xs">{attachment.fileName}</p>
            {canDelete && (
              <Button
                variant="destructive"
                size="icon-sm"
                className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => deleteMutation.mutate(attachment.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
