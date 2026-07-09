"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileSpreadsheet } from "lucide-react";
import {
  MAINTENANCE_REPORT_TYPE_LABELS,
  type MaintenanceReportTypeValue,
} from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicle } from "@/features/vehicles/api";
import { listMaintenanceRequests } from "@/features/maintenance/api";

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString("ar-SA") : "—";
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  // BOM so Excel reads Arabic (UTF-8) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VehicleReportPage() {
  const { id } = useParams<{ id: string }>();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => getVehicle(id),
  });
  const { data: requests } = useQuery({
    queryKey: ["maintenance", "vehicle", id],
    queryFn: () => listMaintenanceRequests({ vehicleId: id, pageSize: 100 }),
  });

  if (isLoading || !vehicle) return <Skeleton className="h-64 w-full" />;

  const items = requests?.items ?? [];
  const faults = items.filter((r) => r.reportType === "VEHICLE_FAULT").length;
  const periodic = items.filter((r) => r.reportType === "PERIODIC_MAINTENANCE").length;
  const totalCost = items.reduce(
    (s, r) => s + Number(r.actualCost ?? r.estimatedCost ?? 0),
    0,
  );

  const stats: [string, string | number][] = [
    ["اللوحة", vehicle.plateNumber],
    ["المركبة", `${vehicle.year} ${vehicle.make} ${vehicle.model}`],
    ["العداد الحالي", `${vehicle.odometer.toLocaleString()} كم`],
    ["تاريخ آخر تغيير زيت", fmtDate(vehicle.lastOilChangeAt)],
    ["العداد عند تغيير الزيت", vehicle.oilChangeOdometer?.toLocaleString() ?? "—"],
    ["موعد الصيانة القادم", fmtDate(vehicle.nextMaintenanceAt)],
    ["موعد الفحص القادم", fmtDate(vehicle.nextInspectionAt)],
    ["إجمالي البلاغات", items.length],
    ["بلاغات صيانة دورية", periodic],
    ["بلاغات أعطال", faults],
    ["إجمالي التكلفة", totalCost ? `${totalCost.toLocaleString()} ريال` : "—"],
  ];

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ["تقرير المركبة", vehicle.plateNumber],
      [],
      ...stats,
      [],
      ["رقم البلاغ", "العنوان", "النوع", "الحالة", "التكلفة", "التاريخ"],
      ...items.map((r) => [
        r.requestNumber,
        r.title,
        r.reportType
          ? MAINTENANCE_REPORT_TYPE_LABELS[r.reportType as MaintenanceReportTypeValue].ar
          : "—",
        r.status,
        r.actualCost ?? r.estimatedCost ?? "",
        new Date(r.createdAt).toLocaleDateString("ar-SA"),
      ]),
    ];
    downloadCsv(`تقرير-${vehicle.plateNumber}.csv`, rows);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold">تقرير المركبة — {vehicle.plateNumber}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة / PDF
          </Button>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="size-4" /> تصدير Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملخص المركبة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل البلاغات والصيانة ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-xs text-muted-foreground">
                <th className="p-2">رقم البلاغ</th>
                <th className="p-2">العنوان</th>
                <th className="p-2">النوع</th>
                <th className="p-2">الحالة</th>
                <th className="p-2">التكلفة</th>
                <th className="p-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.requestNumber}</td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">
                    {r.reportType
                      ? MAINTENANCE_REPORT_TYPE_LABELS[r.reportType as MaintenanceReportTypeValue].ar
                      : "—"}
                  </td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.actualCost ?? r.estimatedCost ?? "—"}</td>
                  <td className="p-2">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    لا توجد بلاغات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
