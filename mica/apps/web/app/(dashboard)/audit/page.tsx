"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, Search } from "lucide-react";
import { listAuditLog } from "@/features/audit/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Event log — who did what, to which entity, and when. */
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");

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
                  <th className="px-3 py-2 font-medium">الوقت</th>
                  <th className="px-3 py-2 font-medium">المستخدم</th>
                  <th className="px-3 py-2 font-medium">الإجراء</th>
                  <th className="px-3 py-2 font-medium">النوع</th>
                  <th className="px-3 py-2 font-medium">المعرّف</th>
                  <th className="px-3 py-2 font-medium">الطريقة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-3 py-2 font-medium">{e.userName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.entityType ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">
                      {e.entityId ? e.entityId.slice(0, 10) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                      {e.method ?? ""} {e.path ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
