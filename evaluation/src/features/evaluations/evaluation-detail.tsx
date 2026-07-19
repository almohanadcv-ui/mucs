"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { QuestionType } from "@/core/domain/enums";
import { EvaluationStatusBadge } from "@/features/dashboard/status-badges";
import { useEvaluation, useReviewEvaluation, type EvaluationDetail } from "./use-evaluations";
import { useI18n } from "@/i18n/client";

type TFn = (key: string, params?: Record<string, string | number>) => string;

function formatAnswer(
  question: EvaluationDetail["template"]["questions"][number],
  answer: EvaluationDetail["answers"][number] | undefined,
  t: TFn,
  locale: string,
): React.ReactNode {
  if (!answer) return <span className="text-muted-foreground">—</span>;
  const cfg = question.config ?? {};
  switch (question.type) {
    case QuestionType.STAR_RATING: {
      const n = answer.valueNumber ?? 0;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="flex">
            {Array.from({ length: cfg.max ?? 5 }, (_, i) => (
              <Star key={i} className={i < n ? "size-4 fill-warning text-warning" : "size-4 text-muted-foreground/30"} />
            ))}
          </span>
          {(cfg.max ?? 5) === 5 && <span className="text-xs text-muted-foreground">{t(`starLabels.${n}`)}</span>}
        </span>
      );
    }
    case QuestionType.YES_NO:
      return answer.valueBool ? t("evaluations.yes") : t("evaluations.no");
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.DROPDOWN:
      return cfg.options?.find((o) => o.value === answer.valueText)?.label ?? answer.valueText;
    case QuestionType.MULTIPLE_CHOICE: {
      const arr = Array.isArray(answer.valueJson) ? (answer.valueJson as string[]) : [];
      return arr.map((v) => cfg.options?.find((o) => o.value === v)?.label ?? v).join(t("common.listSep"));
    }
    case QuestionType.NUMBER:
      return answer.valueNumber ?? "—";
    case QuestionType.DATE:
      return answer.valueDate ? new Date(answer.valueDate).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—";
    case QuestionType.FILE_UPLOAD:
      return (answer.valueJson as { name?: string } | null)?.name ?? t("evaluations.file");
    default:
      return answer.valueText ?? "—";
  }
}

export function EvaluationDetailView({
  id,
  canReview,
}: {
  id: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data, isLoading } = useEvaluation(id);
  const review = useReviewEvaluation(id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-destructive">{t("evaluations.loadFailed")}</p>;
  }

  const answersByQ = new Map(data.answers.map((a) => [a.questionId, a]));
  const isPending = data.status === "PENDING";

  async function approve() {
    try {
      await review.mutateAsync({ decision: "APPROVE" });
      toast.success(t("evaluations.approved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.approveFailed"));
    }
  }
  async function reject() {
    if (reason.trim().length < 3) return toast.error(t("evaluations.rejectReasonRequired"));
    try {
      await review.mutateAsync({ decision: "REJECT", reason: reason.trim() });
      toast.success(t("evaluations.rejected"));
      setRejectOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.rejectFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.template.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("evaluations.employeeLabel")}: {data.employee?.name} · {t("picker.evaluatorPrefix", { name: data.evaluator?.name ?? "" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.score != null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-3 py-1 font-bold text-success">
              <Star className="size-4 fill-current" /> {data.score}
            </span>
          )}
          <EvaluationStatusBadge status={data.status} />
        </div>
      </div>

      {data.status === "REJECTED" && data.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("evaluations.rejectReasonPrefix")} {data.rejectionReason}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t("evaluations.answers")}</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data.template.questions.map((q, i) => (
            <div key={q.id ?? i} className="flex items-start justify-between gap-4 py-3">
              <span className="text-sm text-muted-foreground">{i + 1}. {q.label}</span>
              <span className="text-sm font-medium">{formatAnswer(q, answersByQ.get(q.id!), t, locale)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {canReview && isPending && (
        <div className="flex justify-start gap-3">
          <Button onClick={approve} disabled={review.isPending}>
            {review.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {t("evaluations.approve")}
          </Button>
          <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={review.isPending}>
            <X className="size-4" /> {t("evaluations.reject")}
          </Button>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("evaluations.rejectReasonTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{t("evaluations.writeRejectReason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={reject} disabled={review.isPending}>
              {review.isPending && <Loader2 className="size-4 animate-spin" />} {t("evaluations.confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
