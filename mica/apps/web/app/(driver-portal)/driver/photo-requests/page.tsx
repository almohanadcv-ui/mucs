"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listMyPhotoRequests,
  replyToPhotoRequest,
  type PhotoRequestItem,
} from "@/features/photo-requests/api";

function ReplyForm({ request, onDone }: { request: PhotoRequestItem; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => replyToPhotoRequest(request.id, files, note || undefined),
    onSuccess: () => {
      toast.success("تم إرسال الصور للفني");
      onDone();
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر الإرسال")
        : "تعذّر الإرسال";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        capture="environment"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
      />
      <textarea
        rows={2}
        placeholder="ملاحظة (اختياري)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        disabled={!files.length || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />} إرسال الصور ({files.length})
      </Button>
    </div>
  );
}

export default function DriverPhotoRequestsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-photo-requests"],
    queryFn: listMyPhotoRequests,
  });
  const rows = data ?? [];

  return (
    <div className="space-y-4 pb-24" dir="rtl">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Camera className="size-6 text-primary" /> طلبات التصوير
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">لا توجد طلبات حالياً.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{r.message}</p>
              {r.status === "ANSWERED" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="size-4" /> تم الرد
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-amber-600">بانتظار الرد</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              من: {r.requestedByName ?? "—"} · {new Date(r.createdAt).toLocaleString("ar-SA")}
            </p>
            {r.attachments && r.attachments.length > 0 && (
              <p className="text-xs text-muted-foreground">تم إرفاق {r.attachments.length} ملف.</p>
            )}
            {r.status !== "ANSWERED" && (
              <ReplyForm
                request={r}
                onDone={() => queryClient.invalidateQueries({ queryKey: ["my-photo-requests"] })}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
