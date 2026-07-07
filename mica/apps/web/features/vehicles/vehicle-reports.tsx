"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  attachmentFileUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@/features/media/api";

const REPORT_SLOT = "REPORT";

/** Reports section for a vehicle: upload / download / delete report documents. */
export function VehicleReports({
  vehicleId,
  canManage,
}: {
  vehicleId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-attachments", vehicleId],
    queryFn: () => listAttachments("VEHICLE", vehicleId),
  });
  const reports = (data ?? []).filter((a) => a.documentType === REPORT_SLOT);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["vehicle-attachments", vehicleId] });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await uploadAttachment("VEHICLE", vehicleId, f, REPORT_SLOT);
    },
    onSuccess: () => {
      toast.success("تم رفع التقرير");
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

  return (
    <div className="space-y-4" dir="rtl">
      {canManage && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          رفع تقرير (PDF, Word, صور…)
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) upload.mutate(files);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تقارير بعد.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <FileText className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("ar-SA")} ·{" "}
                  {(r.sizeBytes / 1024).toFixed(0)} KB
                </p>
              </div>
              <a
                href={attachmentFileUrl(r.fileKey)}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="تنزيل"
              >
                <Download className="size-4" />
              </a>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => del.mutate(r.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
