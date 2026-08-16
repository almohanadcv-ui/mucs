"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileSpreadsheet, Pencil, Check, Plus, Trash2, RotateCcw } from "lucide-react";
import {
  MAINTENANCE_REPORT_TYPE_LABELS,
  type MaintenanceReportTypeValue,
} from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { formatSAR } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicle } from "@/features/vehicles/api";
import { listMaintenanceRequests } from "@/features/maintenance/api";

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString("ar-SA") : "—";
}

type Stat = { label: string; value: string };
type Row = {
  key: string;
  requestNumber: string;
  title: string;
  type: string;
  status: string;
  cost: string;
  date: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStats(vehicle: any, items: any[]): Stat[] {
  const faults = items.filter((r) => r.reportType === "VEHICLE_FAULT").length;
  const periodic = items.filter((r) => r.reportType === "PERIODIC_MAINTENANCE").length;
  const totalCost = items.reduce(
    (s, r) => s + Number(r.actualCost ?? r.estimatedCost ?? 0),
    0,
  );
  const pairs: [string, string | number][] = [
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
    ["إجمالي التكلفة", totalCost ? formatSAR(totalCost) : "—"],
  ];
  return pairs.map(([label, value]) => ({ label, value: String(value) }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRows(items: any[]): Row[] {
  return items.map((r, i) => ({
    key: r.id ?? `row-${i}`,
    requestNumber: r.requestNumber ?? "",
    title: r.title ?? "",
    type: r.reportType
      ? MAINTENANCE_REPORT_TYPE_LABELS[r.reportType as MaintenanceReportTypeValue].ar
      : "—",
    status: r.status ?? "",
    cost: String(r.actualCost ?? r.estimatedCost ?? "—"),
    date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-SA") : "",
  }));
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

// حقل قابل للتحرير: يظهر كنص عادي، وكصندوق إدخال أثناء التعديل. عند الطباعة يظهر كنص نظيف.
function EditableText({
  value,
  editing,
  onChange,
  className = "",
}: {
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  className?: string;
}) {
  if (!editing) return <span className={className}>{value || "—"}</span>;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring print:border-0 print:bg-transparent print:px-0 ${className}`}
    />
  );
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

  // نسخة محلّية قابلة للتحرير (مؤقتة — لا تُحفظ في قاعدة البيانات، تُلتقط عند الطباعة/التصدير فقط)
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [statList, setStatList] = useState<Stat[]>([]);
  const [rowList, setRowList] = useState<Row[]>([]);
  const seededRef = useRef(false);

  // نملأ الحالة القابلة للتحرير مرّة واحدة عند وصول البيانات (لا نطمس تعديلات المستخدم لاحقاً)
  useEffect(() => {
    if (seededRef.current || !vehicle) return;
    seededRef.current = true;
    setTitle(`تقرير المركبة — ${vehicle.plateNumber}`);
    setStatList(buildStats(vehicle, requests?.items ?? []));
    setRowList(buildRows(requests?.items ?? []));
  }, [vehicle, requests]);

  function resetToOriginal() {
    if (!vehicle) return;
    setTitle(`تقرير المركبة — ${vehicle.plateNumber}`);
    setStatList(buildStats(vehicle, requests?.items ?? []));
    setRowList(buildRows(requests?.items ?? []));
  }

  if (isLoading || !vehicle) return <Skeleton className="h-64 w-full" />;

  const plate = vehicle.plateNumber;

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      [title],
      [],
      ...statList.map((s) => [s.label, s.value]),
      [],
      ["رقم البلاغ", "العنوان", "النوع", "الحالة", "التكلفة", "التاريخ"],
      ...rowList.map((r) => [r.requestNumber, r.title, r.type, r.status, r.cost, r.date]),
    ];
    downloadCsv(`تقرير-${plate}.csv`, rows);
  };

  const updateStat = (i: number, patch: Partial<Stat>) =>
    setStatList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeStat = (i: number) => setStatList((prev) => prev.filter((_, idx) => idx !== i));
  const addStat = () => setStatList((prev) => [...prev, { label: "حقل جديد", value: "" }]);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRowList((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRowList((prev) => prev.filter((r) => r.key !== key));
  const addRow = () =>
    setRowList((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        requestNumber: "",
        title: "",
        type: "",
        status: "",
        cost: "",
        date: new Date().toLocaleDateString("ar-SA"),
      },
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-2 print:hidden">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-2xl font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <h1 className="text-2xl font-semibold">{title}</h1>
        )}
        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={resetToOriginal}>
                <RotateCcw className="size-4" /> استرجاع الأصل
              </Button>
              <Button onClick={() => setEditing(false)}>
                <Check className="size-4" /> تم التعديل
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> تعديل التقرير
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> طباعة / PDF
              </Button>
              <Button variant="outline" onClick={exportExcel}>
                <FileSpreadsheet className="size-4" /> تصدير Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* العنوان في وضع الطباعة (يظهر فقط عند الطباعة) */}
      <h1 className="hidden text-2xl font-semibold print:block">{title}</h1>

      {editing && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground print:hidden">
          أنت في وضع التعديل المؤقّت — عدّل أي حقل، أضِف أو احذف بلاغات، ثم اضغط «تم التعديل» وبعدها «طباعة / PDF» أو
          «تصدير Excel». التغييرات لا تُحفظ في النظام، وتُستخدم للطباعة فقط.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ملخص المركبة</CardTitle>
          {editing && (
            <Button variant="outline" size="sm" onClick={addStat} className="print:hidden">
              <Plus className="size-4" /> إضافة حقل
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statList.map((s, i) => (
            <div key={i} className="relative rounded-md border p-3">
              {editing && (
                <button
                  type="button"
                  onClick={() => removeStat(i)}
                  className="absolute left-2 top-2 text-muted-foreground hover:text-destructive print:hidden"
                  aria-label="حذف الحقل"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <EditableText
                value={s.label}
                editing={editing}
                onChange={(v) => updateStat(i, { label: v })}
                className="text-xs text-muted-foreground"
              />
              <div className="mt-1">
                <EditableText
                  value={s.value}
                  editing={editing}
                  onChange={(v) => updateStat(i, { value: v })}
                  className="text-sm font-medium"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل البلاغات والصيانة ({rowList.length})</CardTitle>
          {editing && (
            <Button variant="outline" size="sm" onClick={addRow} className="print:hidden">
              <Plus className="size-4" /> إضافة بلاغ
            </Button>
          )}
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
                {editing && <th className="p-2 print:hidden" />}
              </tr>
            </thead>
            <tbody>
              {rowList.map((r) => (
                <tr key={r.key} className="border-b">
                  <td className="p-2">
                    <EditableText value={r.requestNumber} editing={editing} onChange={(v) => updateRow(r.key, { requestNumber: v })} />
                  </td>
                  <td className="p-2">
                    <EditableText value={r.title} editing={editing} onChange={(v) => updateRow(r.key, { title: v })} />
                  </td>
                  <td className="p-2">
                    <EditableText value={r.type} editing={editing} onChange={(v) => updateRow(r.key, { type: v })} />
                  </td>
                  <td className="p-2">
                    <EditableText value={r.status} editing={editing} onChange={(v) => updateRow(r.key, { status: v })} />
                  </td>
                  <td className="p-2">
                    <EditableText value={r.cost} editing={editing} onChange={(v) => updateRow(r.key, { cost: v })} />
                  </td>
                  <td className="p-2">
                    <EditableText value={r.date} editing={editing} onChange={(v) => updateRow(r.key, { date: v })} />
                  </td>
                  {editing && (
                    <td className="p-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="حذف البلاغ"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rowList.length === 0 && (
                <tr>
                  <td colSpan={editing ? 7 : 6} className="p-4 text-center text-muted-foreground">
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
