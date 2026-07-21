"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/lib/auth/use-permission";
import { MaintenanceDeleteButton } from "@/features/maintenance/maintenance-delete-button";
import { getMaintenanceHistory, getMaintenanceRequest } from "@/features/maintenance/api";
import { StatusMoveMenu } from "@/features/maintenance/status-move-menu";
import { ApprovalsPanel } from "@/features/maintenance/approvals-panel";
import { SparePartsPanel } from "@/features/maintenance/spare-parts-panel";
import { MediaGallery } from "@/components/media/media-gallery";

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  CRITICAL: "destructive",
};

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("maintenance");
  const canUpload = usePermission("media:create");
  const canDeleteMedia = usePermission("media:delete");
  const canDelete = usePermission("maintenance:delete");

  const { data: request, isLoading } = useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => getMaintenanceRequest(id),
  });
  const { data: history } = useQuery({
    queryKey: ["maintenance", id, "history"],
    queryFn: () => getMaintenanceHistory(id),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!request) return <p className="text-muted-foreground">{t("notFound")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{request.requestNumber}</h1>
            <Badge>{t(`statuses.${request.status}`)}</Badge>
            <Badge variant={PRIORITY_VARIANT[request.priority] ?? "secondary"}>
              {t(`priorities.${request.priority}`)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{request.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <MaintenanceDeleteButton
              requestId={request.id}
              requestNumber={request.requestNumber}
            />
          )}
          <div className="w-40">
            <StatusMoveMenu requestId={request.id} currentStatus={request.status} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="approvals">{t("approvals")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("timeline")}</TabsTrigger>
          <TabsTrigger value="parts">{t("spareParts")}</TabsTrigger>
          <TabsTrigger value="media">{t("media")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <Field label={t("description")} value={request.description} full />
              <Field label={t("vehicle")} value={request.vehicle?.plateNumber} />
              <Field label={t("branch")} value={request.branch?.name} />
              <Field
                label={t("reportedBy")}
                value={
                  request.reportedBy
                    ? `${request.reportedBy.firstName} ${request.reportedBy.lastName}`
                    : undefined
                }
              />
              <Field
                label={t("assignedTo")}
                value={
                  request.assignedTo
                    ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}`
                    : undefined
                }
              />
              <Field
                label={t("scheduledDate")}
                value={request.scheduledDate ? new Date(request.scheduledDate).toLocaleString() : undefined}
              />
              <Field label={t("estimatedCost")} value={request.estimatedCost ?? undefined} />
              <Field label={t("actualCost")} value={request.actualCost ?? undefined} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>{t("approvalChain")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalsPanel requestId={request.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {history?.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">
                      {entry.fromStatus ? `${t(`statuses.${entry.fromStatus}`)} -> ` : ""}
                      {t(`statuses.${entry.toStatus}`)}
                    </p>
                    {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.changedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <CardHeader>
              <CardTitle>{t("sparePartsUsed")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SparePartsPanel requestId={request.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>{t("photosDocuments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaGallery
                entityType="MAINTENANCE_REQUEST"
                entityId={request.id}
                canUpload={canUpload}
                canDelete={canDeleteMedia}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-3" : undefined}>
      <p className="text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value ?? "-"}</p>
    </div>
  );
}
