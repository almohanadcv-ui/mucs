"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EvaluationStatusBadge } from "@/features/dashboard/status-badges";
import { useEvaluations } from "./use-evaluations";
import { useI18n } from "@/i18n/client";

const FILTERS = [
  { value: "", label: "common.all" },
  { value: "PENDING", label: "evalStatus.PENDING" },
  { value: "APPROVED", label: "evalStatus.APPROVED" },
  { value: "REJECTED", label: "evalStatus.REJECTED" },
  { value: "DRAFT", label: "evalStatus.DRAFT" },
];

function fmt(d: string | null, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—";
}

export function EvaluationsClient({ canCreate }: { canCreate: boolean }) {
  const { t, locale } = useI18n();
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
            <ClipboardList className="size-6 text-primary" /> {t("evaluations.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("evaluations.count", { n: meta?.total ?? 0 })}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/evaluations/new">
              <Plus className="size-4" /> {t("evaluations.new")}
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
            {t(f.label)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("evaluations.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("evaluations.colEmployee")}</th>
                    <th className="px-3 py-2 font-medium">{t("evaluations.colTemplate")}</th>
                    <th className="px-3 py-2 font-medium">{t("evaluations.colEvaluator")}</th>
                    <th className="px-3 py-2 font-medium">{t("evaluations.colScore")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.date")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3 font-medium">{e.employee?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.template?.title ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.evaluator?.name ?? "—"}</td>
                      <td className="px-3 py-3">
                        {e.score != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <Star className="size-3.5 fill-current" />{e.score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmt(e.submittedAt, locale)}</td>
                      <td className="px-3 py-3"><EvaluationStatusBadge status={e.status} /></td>
                      <td className="px-3 py-3">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/evaluations/${e.id}`}>{t("common.view")}</Link>
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
              <span className="text-xs text-muted-foreground">{t("common.pageOf", { page: meta.page, total: meta.totalPages })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
