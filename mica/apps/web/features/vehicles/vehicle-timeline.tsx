"use client";

import { useQuery } from "@tanstack/react-query";
import { Wrench, ClipboardCheck, CalendarClock, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getVehicleTimeline, type TimelineItem } from "./api";

const KIND_ICON = {
  maintenance: Wrench,
  inspection: ClipboardCheck,
  appointment: CalendarClock,
  audit: History,
} as const;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "مجدول",
  CONFIRMED: "مؤكد",
  COMPLETED: "منجز",
  CANCELLED: "ملغي",
  NO_SHOW: "لم يحضر",
};

export function VehicleTimeline({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", vehicleId, "timeline"],
    queryFn: () => getVehicleTimeline(vehicleId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">لا يوجد سجل لهذه المركبة بعد.</p>;

  return (
    <ol className="relative space-y-4 border-s pl-0 pr-4" dir="rtl">
      {data.map((item: TimelineItem, i) => {
        const Icon = KIND_ICON[item.kind] ?? History;
        return (
          <li key={i} className="relative pr-6">
            <span className="absolute -right-[9px] top-1 grid size-4 place-items-center rounded-full bg-primary/15 text-primary ring-4 ring-background">
              <Icon className="size-3" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              {item.status && (
                <Badge variant={item.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px]">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(item.at).toLocaleString("ar-SA")}
              {item.actor ? ` — ${item.actor}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
