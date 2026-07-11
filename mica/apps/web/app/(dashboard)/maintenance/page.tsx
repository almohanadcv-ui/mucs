"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_PRIORITY_META,
  MAINTENANCE_REPORT_TYPE_LABELS,
  type MaintenancePriorityValue,
  type MaintenanceReportTypeValue,
} from "@mica-mab/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { listMaintenanceRequests } from "@/features/maintenance/api";
import { StatusMoveMenu } from "@/features/maintenance/status-move-menu";

export default function MaintenancePage() {
  const canCreate = usePermission("maintenance:create");
  const t = useTranslations("maintenance");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MaintenanceReportTypeValue | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriorityValue | "ALL">("ALL");
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [showEmpty, setShowEmpty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => listMaintenanceRequests({ page: 1, pageSize: 200 }),
  });

  const technicians = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of data?.items ?? []) {
      if (i.assignedTo) map.set(i.assignedTo.id, `${i.assignedTo.firstName} ${i.assignedTo.lastName}`);
    }
    return [...map.entries()];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((i) => {
      if (typeFilter !== "ALL" && i.reportType !== typeFilter) return false;
      if (priorityFilter !== "ALL" && i.priority !== priorityFilter) return false;
      if (technicianFilter !== "ALL" && i.assignedTo?.id !== technicianFilter) return false;
      if (
        q &&
        !`${i.requestNumber} ${i.title} ${i.vehicle?.plateNumber ?? ""}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [data, search, typeFilter, priorityFilter, technicianFilter]);

  const columns = MAINTENANCE_STATUSES.map((status) => ({
    status,
    items: filtered.filter((i) => i.status === status),
  })).filter((c) => showEmpty || c.items.length > 0);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/maintenance/new">{t("newRequest")}</Link>
          </Button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="بحث برقم الطلب أو العنوان أو اللوحة…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <FilterSelect value={typeFilter} onChange={(v) => setTypeFilter(v as never)}>
          <option value="ALL">كل الأنواع</option>
          <option value="PERIODIC_MAINTENANCE">صيانة دورية</option>
          <option value="VEHICLE_FAULT">عطل في المركبة</option>
        </FilterSelect>
        <FilterSelect value={priorityFilter} onChange={(v) => setPriorityFilter(v as never)}>
          <option value="ALL">كل الأولويات</option>
          {(Object.keys(MAINTENANCE_PRIORITY_META) as MaintenancePriorityValue[]).map((p) => (
            <option key={p} value={p}>
              {MAINTENANCE_PRIORITY_META[p].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={technicianFilter} onChange={setTechnicianFilter}>
          <option value="ALL">كل الفنيين</option>
          {technicians.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(e) => setShowEmpty(e.target.checked)}
          />
          إظهار الأعمدة الفارغة
        </label>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-64" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map(({ status, items }) => (
            <div key={status} className="w-64 shrink-0 space-y-2">
              <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-1.5">
                <h2 className="text-xs font-semibold">{MAINTENANCE_STATUS_LABELS[status]}</h2>
                <Badge variant="secondary" className="h-5 min-w-5 justify-center text-[10px]">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  const pr = MAINTENANCE_PRIORITY_META[item.priority as MaintenancePriorityValue];
                  return (
                    <Card key={item.id} className="border-muted">
                      <CardContent className="space-y-1.5 p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/maintenance/${item.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {item.requestNumber}
                          </Link>
                          {pr && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span
                                className="inline-block size-2 rounded-full"
                                style={{ backgroundColor: pr.dot }}
                              />
                              {pr.label}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-1 text-foreground/80">{item.title}</p>
                        {item.vehicle && (
                          <p className="text-muted-foreground">
                            {item.vehicle.make} {item.vehicle.model}
                            <span className="mx-1">·</span>
                            <span dir="ltr">{item.vehicle.plateNumber}</span>
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          {item.reportType && (
                            <span>{MAINTENANCE_REPORT_TYPE_LABELS[item.reportType].ar}</span>
                          )}
                          <span>{new Date(item.createdAt).toLocaleDateString("ar-SA")}</span>
                        </div>
                        {item.assignedTo && (
                          <p className="text-[10px] text-muted-foreground">
                            الفني: {item.assignedTo.firstName} {item.assignedTo.lastName}
                          </p>
                        )}
                        <StatusMoveMenu requestId={item.id} currentStatus={item.status} />
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">{t("emptyStatus")}</p>
                )}
              </div>
            </div>
          ))}
          {columns.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد طلبات مطابقة.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
    >
      {children}
    </select>
  );
}
