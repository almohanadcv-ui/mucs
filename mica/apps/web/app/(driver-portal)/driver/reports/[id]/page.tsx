"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyReport } from "@/features/driver-portal/api";
import { attachmentFileUrl } from "@/features/media/api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  APPROVED: "تم الاعتماد",
  IN_PROGRESS: "جاري التنفيذ",
  COMPLETED: "مكتمل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

export default function DriverReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-reports", id],
    queryFn: () => getMyReport(id),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError || !data)
    return <p className="py-16 text-center text-destructive">تعذّر تحميل البلاغ.</p>;

  const photos = (data.attachments ?? []).filter((a) => a.kind === "IMAGE");

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{data.requestNumber}</h1>
        <Link
          href="/driver/reports"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-4" /> رجوع
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            {data.vehicle ? `${data.vehicle.make} ${data.vehicle.model}` : "البلاغ"}
          </CardTitle>
          <Badge variant={data.status === "APPROVED" ? "default" : "secondary"}>
            {STATUS_LABEL[data.status] ?? data.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.vehicle && (
            <p className="text-muted-foreground" dir="ltr">
              {data.vehicle.plateNumber}
            </p>
          )}
          <div>
            <p className="text-xs text-muted-foreground">الوصف</p>
            <p>{data.description}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(data.createdAt).toLocaleString("ar-SA")}
          </p>
        </CardContent>
      </Card>

      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">الصور المرفقة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {photos.map((a) => (
              <a key={a.id} href={attachmentFileUrl(a.fileKey)} target="_blank" rel="noreferrer">
                <img
                  src={attachmentFileUrl(a.thumbnailKey ?? a.fileKey)}
                  alt={a.fileName}
                  className="size-24 rounded-md border object-cover"
                />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {data.comments && data.comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">التعليقات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.comments.map((c) => (
              <div key={c.id} className="rounded-md border p-2 text-sm">
                <p>{c.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString("ar-SA")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
