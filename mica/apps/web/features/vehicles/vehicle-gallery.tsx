"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  attachmentFileUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
  type AttachmentItem,
} from "@/features/media/api";
import { PHOTO_SLOT_GROUPS } from "./photo-slots";

/** Per-slot photo/video gallery for a vehicle (upload, view full-size, delete). */
export function VehicleGallery({
  vehicleId,
  canManage,
}: {
  vehicleId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<AttachmentItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-attachments", vehicleId],
    queryFn: () => listAttachments("VEHICLE", vehicleId),
  });
  const attachments = data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["vehicle-attachments", vehicleId] });

  const upload = useMutation({
    mutationFn: async ({ files, slot }: { files: File[]; slot: string }) => {
      for (const f of files) await uploadAttachment("VEHICLE", vehicleId, f, slot);
    },
    onSuccess: () => {
      toast.success("تم رفع الملفات");
      invalidate();
    },
    onError: (e) =>
      toast.error(
        isAxiosError(e)
          ? ((e.response?.data as { message?: string })?.message ?? "تعذّر الرفع")
          : "تعذّر الرفع",
      ),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: () => {
      toast.success("تم الحذف");
      invalidate();
    },
    onError: () => toast.error("تعذّر الحذف"),
  });

  const bySlot = (slot: string) => attachments.filter((a) => a.documentType === slot);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {PHOTO_SLOT_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.slots.map((slot) => {
              const items = bySlot(slot.key);
              return (
                <div key={slot.key} className="rounded-lg border p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">{slot.label}</span>
                    <span className="text-[10px] text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className="group relative aspect-square overflow-hidden rounded bg-muted"
                      >
                        {a.kind === "VIDEO" ? (
                          <video
                            src={attachmentFileUrl(a.fileKey)}
                            className="size-full cursor-pointer object-cover"
                            onClick={() => setPreview(a)}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachmentFileUrl(a.fileKey)}
                            alt={slot.label}
                            className="size-full cursor-pointer object-cover"
                            onClick={() => setPreview(a)}
                          />
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => del.mutate(a.id)}
                            className="absolute left-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
                            aria-label="حذف"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {canManage && (
                      <div className="flex aspect-square flex-col overflow-hidden rounded border border-dashed">
                        {/* Take a photo directly (camera). `capture` needs a
                            single, non-multiple input to reliably open the camera. */}
                        <label
                          className="flex flex-1 cursor-pointer items-center justify-center text-muted-foreground hover:bg-muted"
                          title="التقاط صورة بالكاميرا"
                        >
                          {upload.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Camera className="size-4" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (files.length) upload.mutate({ files, slot: slot.key });
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {/* Pick from the album (multiple). */}
                        <label
                          className="flex flex-1 cursor-pointer items-center justify-center border-t border-dashed text-muted-foreground hover:bg-muted"
                          title="اختيار من الألبوم"
                        >
                          <ImagePlus className="size-4" />
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (files.length) upload.mutate({ files, slot: slot.key });
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview &&
            (preview.kind === "VIDEO" ? (
              <video src={attachmentFileUrl(preview.fileKey)} controls className="max-h-[80vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachmentFileUrl(preview.fileKey)}
                alt=""
                className="max-h-[80vh] w-full object-contain"
              />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
