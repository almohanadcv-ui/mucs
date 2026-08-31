"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeftRight, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getVehicleHandovers, type VehicleHandover } from "./api";

const FUEL_LABEL: Record<string, string> = {
  FULL: "ممتلئ", THREE_QUARTERS: "ثلاثة أرباع", HALF: "نصف", QUARTER: "ربع", EMPTY: "فارغ",
};
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("ar-SA") : "—");

/**
 * A separate report per driver custody period, newest first. Between two
 * periods it shows the «تغيير السائق من X إلى Y» change, and each report can be
 * printed on its own (the report captured at handover time).
 */
export function VehicleHandoverReports({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", vehicleId, "handovers"],
    queryFn: () => getVehicleHandovers(vehicleId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">لا يوجد سجل تسليم لسائقين بعد.</p>;

  return (
    <div className="space-y-3">
      {data.map((h, i) => {
        const prev = data[i + 1]; // older period (list is newest-first)
        return (
          <div key={h.id} className="space-y-3">
            {prev && (
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-primary">
                <ArrowLeftRight className="size-4" />
                تم تغيير السائق من {prev.driverName} إلى {h.driverName}
              </div>
            )}
            <HandoverReport h={h} />
          </div>
        );
      })}
    </div>
  );
}

function HandoverReport({ h }: { h: VehicleHandover }) {
  function print() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير تسليم — ${h.driverName}</title>
      <style>body{font-family:system-ui,'Segoe UI',sans-serif;padding:32px;color:#12304a}
      h1{font-size:20px} .row{margin:8px 0} .lbl{color:#64748b;font-size:13px} .val{font-weight:600}</style>
      </head><body>
      <h1>تقرير تسليم المركبة</h1>
      <div class="row"><span class="lbl">السائق:</span> <span class="val">${h.driverName}</span></div>
      <div class="row"><span class="lbl">تاريخ التسليم:</span> <span class="val">${fmt(h.assignedAt)}</span></div>
      <div class="row"><span class="lbl">سلّمها:</span> <span class="val">${h.assignedByName ?? "—"}</span></div>
      <div class="row"><span class="lbl">تاريخ الاستلام:</span> <span class="val">${fmt(h.returnedAt)}</span></div>
      <div class="row"><span class="lbl">استلمها:</span> <span class="val">${h.returnedByName ?? "—"}</span></div>
      <div class="row"><span class="lbl">العداد:</span> <span class="val">${h.odometer != null ? h.odometer.toLocaleString() + " كم" : "—"}</span></div>
      <div class="row"><span class="lbl">الوقود:</span> <span class="val">${h.fuelLevel ? (FUEL_LABEL[h.fuelLevel] ?? h.fuelLevel) : "—"}</span></div>
      <div class="row"><span class="lbl">ملاحظات:</span> <span class="val">${h.notes ?? "—"}</span></div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4 text-primary" /> تقرير السائق: {h.driverName}
          <Badge variant={h.returnedAt ? "secondary" : "default"} className="text-[10px]">
            {h.returnedAt ? "منتهٍ" : "قائم"}
          </Badge>
        </CardTitle>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={print}>
          <Printer className="size-4" /> طباعة
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-3" dir="rtl">
        <Field label="تاريخ التسليم" value={fmt(h.assignedAt)} />
        <Field label="سلّمها" value={h.assignedByName ?? "—"} />
        <Field label="تاريخ الاستلام" value={fmt(h.returnedAt)} />
        <Field label="استلمها" value={h.returnedByName ?? "—"} />
        <Field label="العداد" value={h.odometer != null ? `${h.odometer.toLocaleString()} كم` : "—"} />
        <Field label="الوقود" value={h.fuelLevel ? (FUEL_LABEL[h.fuelLevel] ?? h.fuelLevel) : "—"} />
        {h.notes && <div className="sm:col-span-3"><Field label="ملاحظات" value={h.notes} /></div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
