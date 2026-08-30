"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMaintenanceCosts, type MaintenanceCostMonth } from "./api";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS_AR[Number(m) - 1] ?? m} ${y}`;
}
const money = (n: number) => `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;

/**
 * «الصيانة المستحقة» — total maintenance cost, drillable: all months → a month's
 * total → that month's invoices. Only ACCEPTED invoices count.
 */
export function VehicleMaintenanceCosts({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", vehicleId, "maintenance-costs"],
    queryFn: () => getMaintenanceCosts(vehicleId),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-5 text-primary" /> تكلفة الصيانة
        </CardTitle>
        {data && <span className="text-lg font-bold text-primary">{money(data.grandTotal)}</span>}
      </CardHeader>
      <CardContent className="space-y-2" dir="rtl">
        {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {data && data.months.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد فواتير صيانة معتمدة بعد.</p>
        )}
        {data?.months.map((m) => <MonthRow key={m.month} month={m} />)}
      </CardContent>
    </Card>
  );
}

function MonthRow({ month }: { month: MaintenanceCostMonth }) {
  const [open, setOpen] = useState(false);
  const money2 = (n: number) => `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-right text-sm hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 font-medium">
          {open ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
          {monthLabel(month.month)}
          <span className="text-xs text-muted-foreground">({month.invoices.length} فاتورة)</span>
        </span>
        <span className="font-semibold text-primary">{money2(month.total)}</span>
      </button>
      {open && (
        <div className="divide-y border-t">
          {month.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium">{inv.invoiceNumber}</p>
                <p className="truncate text-muted-foreground">
                  {inv.workshopName ?? "—"}
                  {inv.description ? ` · ${inv.description}` : ""}
                  {" · "}
                  {new Date(inv.date).toLocaleDateString("ar-SA")}
                </p>
              </div>
              <span className="shrink-0 font-semibold">{money2(inv.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
