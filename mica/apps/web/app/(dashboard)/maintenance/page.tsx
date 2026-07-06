"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { MaintenanceStatusValue } from "@mica-mab/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { listMaintenanceRequests } from "@/features/maintenance/api";
import { StatusMoveMenu } from "@/features/maintenance/status-move-menu";

const COLUMNS: MaintenanceStatusValue[] = [
  "DRAFT",
  "REPORTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "QUALITY_INSPECTION",
  "COMPLETED",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
];

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  CRITICAL: "destructive",
};

export default function MaintenancePage() {
  const canCreate = usePermission("maintenance:create");
  const t = useTranslations("maintenance");

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => listMaintenanceRequests({ page: 1, pageSize: 100 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/maintenance/new">{t("newRequest")}</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => {
            const items = data?.items.filter((item) => item.status === status) ?? [];
            return (
              <div key={status} className="w-72 shrink-0 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{status.replace(/_/g, " ")}</h2>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="p-3 pb-0">
                        <Link href={`/maintenance/${item.id}`} className="text-sm font-medium hover:underline">
                          {item.requestNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item.title}</p>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={PRIORITY_VARIANT[item.priority] ?? "secondary"} className="text-[10px]">
                            {item.priority}
                          </Badge>
                          {item.vehicle && (
                            <span className="text-xs text-muted-foreground">
                              {item.vehicle.plateNumber}
                            </span>
                          )}
                        </div>
                        <StatusMoveMenu requestId={item.id} currentStatus={item.status} />
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 text-xs text-muted-foreground">{t("emptyStatus")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
