"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Star, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EvaluationStatusBadge } from "@/features/dashboard/status-badges";
import { useEvaluations } from "./use-evaluations";

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "PENDING", label: "بانتظار الاعتماد" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "DRAFT", label: "مسودة" },
];

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("ar-EG") : "—";
}

export function EvaluationsClient({ canCreate }: { canCreate: boolean }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEvaluations({ status, page });
  const rows = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="size-6 text-primary" /> التقييمات
          </h1>
          <p className="text-sm text-muted-foreground">{meta?.total ?? 0} تقييم</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/evaluations/new">
              <Plus className="size-4" /> تقييم جديد
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              status === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">لا توجد تقييمات.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">الموظف</th>
                    <th className="px-3 py-2 font-medium">النموذج</th>
                    <th className="px-3 py-2 font-medium">المقيّم</th>
                    <th className="px-3 py-2 font-medium">النتيجة</th>
                    <th className="px-3 py-2 font-medium">التاريخ</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3 font-medium">{e.employee?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {e.source === "DOCUMENT" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="size-3.5 shrink-0" />
                            {e.documentName ?? "ملف وورد"}
                          </span>
                        ) : (
                          (e.template?.title ?? "—")
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.evaluator?.name ?? "—"}</td>
                      <td className="px-3 py-3">
                        {e.score != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <Star className="size-3.5 fill-current" />{e.score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmt(e.submittedAt)}</td>
                      <td className="px-3 py-3"><EvaluationStatusBadge status={e.status} /></td>
                      <td className="px-3 py-3">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/evaluations/${e.id}`}>عرض</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">صفحة {meta.page} من {meta.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
