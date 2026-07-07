"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { attachmentFileUrl } from "@/features/media/api";
import { listVehiclePhotoRequests } from "./api";

/**
 * Mechanic-facing log of "photograph the meters" requests for a vehicle, each
 * showing the driver's reply (note + photos) once they respond.
 */
export function VehiclePhotoRequests({ vehicleId }: { vehicleId: string }) {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["photo-requests", "vehicle", vehicleId],
    queryFn: () => listVehiclePhotoRequests(vehicleId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;
  }

  if (!requests || requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        لا توجد طلبات تصوير لهذه المركبة. استخدم زر «صوّر العدادات» لإرسال طلب.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((r) => {
        const photos = (r.attachments ?? []).filter((a) => a.kind === "IMAGE");
        const answered = r.status === "ANSWERED";
        return (
          <div key={r.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="size-4 text-muted-foreground" /> {r.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.requestedByName ? `طلب: ${r.requestedByName} · ` : ""}
                  {new Date(r.createdAt).toLocaleString("ar-SA")}
                </p>
              </div>
              {answered ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="size-3" /> تم الرد
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="size-3" /> بانتظار الرد
                </Badge>
              )}
            </div>

            {answered && (
              <div className="space-y-2 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">رد السائق</p>
                {r.replyNote && <p className="text-sm">{r.replyNote}</p>}
                {photos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((a) => (
                      <a
                        key={a.id}
                        href={attachmentFileUrl(a.fileKey)}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <img
                          src={attachmentFileUrl(a.thumbnailKey ?? a.fileKey)}
                          alt={a.fileName}
                          className="size-24 rounded-md border object-cover transition-opacity hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد صور مرفقة.</p>
                )}
                {r.answeredAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.answeredAt).toLocaleString("ar-SA")}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
