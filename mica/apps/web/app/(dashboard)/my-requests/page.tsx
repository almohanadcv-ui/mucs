"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  addComment,
  listMaintenanceRequests,
  transitionMaintenanceRequest,
  type MaintenanceListItem,
} from "@/features/maintenance/api";
import { attachmentFileUrl, listAttachments } from "@/features/media/api";

export default function MyRequestsPage() {
  const t = useTranslations("myRequests");
  const { data, isLoading } = useQuery({
    queryKey: ["maintenance", { status: "PENDING_APPROVAL" }],
    queryFn: () => listMaintenanceRequests({ page: 1, pageSize: 100, status: "PENDING_APPROVAL" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((item) => (
          <ReportCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ item }: { item: MaintenanceListItem }) {
  const t = useTranslations("myRequests");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const { data: attachments } = useQuery({
    queryKey: ["attachments", "MAINTENANCE_REQUEST", item.id],
    queryFn: () => listAttachments("MAINTENANCE_REQUEST", item.id),
  });

  const startMutation = useMutation({
    mutationFn: () => transitionMaintenanceRequest(item.id, "IN_PROGRESS"),
    onSuccess: () => {
      toast.success(t("startedToast"));
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("startFailed")
        : t("startFailed");
      toast.error(message);
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => addComment(item.id, note),
    onSuccess: () => {
      toast.success(t("noteAddedToast"));
      setNote("");
      setNoteOpen(false);
    },
    onError: () => toast.error(t("noteFailed")),
  });

  return (
    <Card>
      <CardHeader className="space-y-1 p-4 pb-0">
        <div className="flex items-center justify-between">
          <Link href={`/maintenance/${item.id}`} className="font-medium hover:underline">
            {item.requestNumber}
          </Link>
          <Badge variant="secondary">{t("new")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {item.reportedBy ? `${item.reportedBy.firstName} ${item.reportedBy.lastName}` : "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.vehicle?.plateNumber} — {item.vehicle?.make} {item.vehicle?.model}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <p className="line-clamp-3 text-sm">{item.description}</p>
        <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>

        {!!attachments?.length && (
          <div className="flex gap-1.5 overflow-x-auto">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachmentFileUrl(attachment.fileKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted"
              >
                {attachment.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachmentFileUrl(attachment.thumbnailKey ?? attachment.fileKey)}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="size-4 text-muted-foreground" />
                )}
              </a>
            ))}
          </div>
        )}

        {noteOpen && (
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!note.trim() || noteMutation.isPending}
                onClick={() => noteMutation.mutate()}
              >
                {tc("submit")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNoteOpen(false)}>
                {tc("cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
            {t("startWork")}
          </Button>
          {!noteOpen && (
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
              {t("addNote")}
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/maintenance/${item.id}`}>{t("open")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
