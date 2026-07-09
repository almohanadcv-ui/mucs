"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { FilePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createMyReport,
  listMyVehicles,
  uploadMyReportMedia,
} from "@/features/driver-portal/api";

export default function NewDriverReportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [reportType, setReportType] = useState<"PERIODIC_MAINTENANCE" | "VEHICLE_FAULT" | "">("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { data: vehicles } = useQuery({
    queryKey: ["driver-vehicles"],
    queryFn: listMyVehicles,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const report = await createMyReport({
        vehicleId,
        description,
        reportType: reportType || undefined,
      });
      for (const f of files) await uploadMyReportMedia(report.id, f);
      return report;
    },
    onSuccess: () => {
      toast.success("تم إرسال البلاغ");
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      router.push("/driver/reports");
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر إرسال البلاغ")
        : "تعذّر إرسال البلاغ";
      toast.error(message);
    },
  });

  const canSubmit = !!vehicleId && description.trim().length > 0 && !mutation.isPending;

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24" dir="rtl">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <FilePlus className="size-6 text-primary" /> بلاغ جديد
      </h1>

      <div className="space-y-2">
        <Label>المركبة</Label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">اختر المركبة</option>
          {(vehicles ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.plateNumber} — {v.make} {v.model}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>نوع البلاغ</Label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as typeof reportType)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">اختر النوع</option>
          <option value="PERIODIC_MAINTENANCE">صيانة دورية</option>
          <option value="VEHICLE_FAULT">عطل في المركبة</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>وصف المشكلة / طلب التحقق</Label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="اكتب وصف المشكلة أو اطلب التحقق من أن المركبة تعمل..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>صور / فيديو (اختياري)</Label>
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          capture="environment"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">{files.length} ملف مرفق</p>
        )}
      </div>

      <Button className="w-full" disabled={!canSubmit} onClick={() => mutation.mutate()}>
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />} إرسال البلاغ
      </Button>
    </div>
  );
}
