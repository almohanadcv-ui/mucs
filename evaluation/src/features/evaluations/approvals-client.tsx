"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEvaluations, type EvaluationRow } from "./use-evaluations";
import { useMe } from "@/features/auth/use-me";
import { Permission } from "@/core/domain/permissions";
import { useI18n } from "@/i18n/client";

function fmt(d: string | null, locale: string) {
  return d ? new Date(d).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—";
}

function EvalCard({ e }: { e: EvaluationRow }) {
  const { t, locale } = useI18n();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="font-semibold">{e.employee?.name}</p>
          <p className="text-sm text-muted-foreground">
            {e.template?.title} · {t("picker.evaluatorPrefix", { name: e.evaluator?.name ?? "" })} · {fmt(e.submittedAt, locale)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {e.score != null && (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Star className="size-4 fill-current" /> {e.score}
            </span>
          )}
          <Button asChild size="sm">
            <Link href={`/dashboard/evaluations/${e.id}`}>{t("approvals.review")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** One review queue for a given status. */
function Queue({ status, titleKey }: { status: string; titleKey: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useEvaluations({ status, page: 1 });
  const rows = data?.items ?? [];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {t(titleKey)}{" "}
        <span className="text-sm font-normal text-muted-foreground">({data?.meta.total ?? 0})</span>
      </h2>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("approvals.noneToApprove")}</CardContent></Card>
      ) : (
        <div className="space-y-3">{rows.map((e) => <EvalCard key={e.id} e={e} />)}</div>
      )}
    </section>
  );
}

export function ApprovalsClient() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const canPrelim = me?.permissions?.includes(Permission.EVALUATION_APPROVE_PRELIMINARY) ?? false;
  const canFinal = me?.permissions?.includes(Permission.EVALUATION_APPROVE_FINAL) ?? false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CheckCircle2 className="size-6 text-primary" /> {t("approvals.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("approvals.subtitle")}</p>
      </div>

      {canPrelim && <Queue status="PENDING" titleKey="approvals.prelimQueue" />}
      {canFinal && <Queue status="PRELIMINARY_APPROVED" titleKey="approvals.finalQueue" />}
      {!canPrelim && !canFinal && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("approvals.noneToApprove")}</CardContent></Card>
      )}
    </div>
  );
}
