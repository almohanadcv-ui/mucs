"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, Search, ChevronDown, ChevronLeft, Car } from "lucide-react";
import { listAuditLog, type AuditLogItem } from "@/features/audit/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Event log — who did what, to which entity, and when. */
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-log", page, entityType],
    queryFn: () => listAuditLog({ page, pageSize: 30, entityType: entityType || undefined }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <History className="size-6 text-primary" /> سجل الأحداث
        </h1>
        <p className="text-sm text-muted-foreground">كل من أنشأ أو غيّر أو حذف — ومتى.</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="تصفية حسب النوع (Vehicle, Employee…)"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-sm text-destructive">تعذّر تحميل السجل.</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد أحداث.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 font-medium">الوقت</th>
                  <th className="px-3 py-2 font-medium">الحدث</th>
                  <th className="px-3 py-2 font-medium">المركبة</th>
                  <th className="px-3 py-2 font-medium">المستخدم</th>
                  <th className="px-3 py-2 font-medium">الطريقة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const open = expanded === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                        onClick={() => setExpanded(open ? null : e.id)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          {open ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString("ar-SA")}
                        </td>
                        <td className="px-3 py-2 font-medium">{e.summary ?? e.action}</td>
                        <td className="px-3 py-2">
                          {e.vehicle ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Car className="size-3" /> {e.vehicle.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{e.userName ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                          {e.method ?? ""} {e.path ?? ""}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={6} className="px-6 py-4">
                            <EventDetails e={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* details renderer defined below */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Arabic labels for the fields captured on an event. */
const FIELD_LABELS: Record<string, string> = {
  message: "الرسالة",
  vehicleId: "معرّف المركبة",
  driverId: "معرّف السائق",
  requestedByName: "طلب بواسطة",
  requestedById: "معرّف الطالب",
  status: "الحالة",
  replyNote: "ملاحظة الرد",
  plateNumber: "رقم اللوحة",
  make: "الصانع",
  model: "الطراز",
  year: "السنة",
  odometer: "العداد",
  amount: "المبلغ",
  invoiceNumber: "رقم الفاتورة",
  id: "المعرّف",
  createdAt: "تاريخ الإنشاء",
  answeredAt: "تاريخ الرد",
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Every captured point of an event, shown literally as label/value pairs. */
function EventDetails({ e }: { e: AuditLogItem }) {
  const after = e.changesAfter && typeof e.changesAfter === "object" && !Array.isArray(e.changesAfter)
    ? (e.changesAfter as Record<string, unknown>)
    : null;

  const meta: [string, unknown][] = [
    ["الحدث", e.summary],
    ["الإجراء (نظام)", e.action],
    ["النوع", e.entityType],
    ["المعرّف", e.entityId],
    ["المركبة", e.vehicle?.label ?? null],
    ["السائق", e.driverName],
    ["المستخدم", e.userName],
    ["الطريقة والمسار", `${e.method ?? ""} ${e.path ?? ""}`.trim()],
    ["رمز الاستجابة", e.statusCode],
    ["عنوان IP", e.ipAddress],
    ["المتصفّح", e.userAgent],
    ["معرّف الطلب", e.requestId],
    ["الوقت", new Date(e.createdAt).toLocaleString("ar-SA")],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">تفاصيل الحدث</h4>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {meta.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-xs font-medium" dir="auto">{renderValue(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {after && Object.keys(after).length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">البيانات المسجّلة</h4>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {Object.entries(after).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1">
                <dt className="text-xs text-muted-foreground">{labelFor(k)}</dt>
                <dd className="text-xs font-medium" dir="auto">{renderValue(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
