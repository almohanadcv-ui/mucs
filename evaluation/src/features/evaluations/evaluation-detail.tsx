"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, CheckCheck, RotateCcw, Star, Trash2 } from "lucide-react";
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
import {
  useEvaluation,
  useReviewEvaluation,
  useDeleteEvaluation,
  type EvaluationDetail,
} from "./use-evaluations";
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
  canPreliminary,
  canFinal,
  canReturn,
  canDelete,
}: {
  id: string;
  /** المراجع — اعتماد مبدئي */
  canPreliminary?: boolean;
  /** المراجع الأساسي — اعتماد نهائي */
  canFinal?: boolean;
  /** إعادة للتعديل مع سبب */
  canReturn?: boolean;
  /** kept for compatibility (any review capability) */
  canReview?: boolean;
  /** IT / الإدارة may remove an evaluation entirely. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data, isLoading } = useEvaluation(id);
  const review = useReviewEvaluation(id);
  const del = useDeleteEvaluation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-destructive">{t("evaluations.loadFailed")}</p>;
  }

  const answersByQ = new Map(data.answers.map((a) => [a.questionId, a]));
  const status = data.status;
  // الإدارة/IT hold both approval permissions → may finalize a PENDING directly.
  const shortcut = Boolean(canPreliminary && canFinal);
  const showPrelim = Boolean(canPreliminary) && status === "PENDING";
  const showFinal =
    (Boolean(canFinal) && status === "PRELIMINARY_APPROVED") || (shortcut && status === "PENDING");
  const showReturn =
    Boolean(canReturn) && (status === "PENDING" || status === "PRELIMINARY_APPROVED");
  const showReviewBar = showPrelim || showFinal || showReturn;

  async function act(action: "PRELIMINARY" | "FINAL") {
    try {
      await review.mutateAsync({ action });
      toast.success(action === "FINAL" ? t("evaluations.finalApproved") : t("evaluations.prelimApproved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.approveFailed"));
    }
  }
  async function returnForEdit() {
    if (reason.trim().length < 3) return toast.error(t("evaluations.returnReasonRequired"));
    try {
      await review.mutateAsync({ action: "RETURN", reason: reason.trim() });
      toast.success(t("evaluations.returned"));
      setReturnOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.returnFailed"));
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

      {(status === "NEEDS_EDIT" || status === "REJECTED") && data.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("evaluations.returnReasonPrefix")} {data.rejectionReason}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t("evaluations.answers")}</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data.template.questions.map((q, i) => (
            <div key={q.id ?? i} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">{i + 1}. {q.label}</span>
                <span className="text-sm font-medium">
                  {formatAnswer(q, answersByQ.get(q.id!), t, locale)}
                </span>
              </div>
              {/* The evaluator's note travels with the answer so the reviewer
                  reads the reasoning, not just the grade. */}
              {answersByQ.get(q.id!)?.remarks && (
                <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium">{t("evaluations.remarks")}: </span>
                  {answersByQ.get(q.id!)!.remarks}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {showReviewBar && (
        <div className="flex flex-wrap justify-start gap-3">
          {showPrelim && (
            <Button onClick={() => act("PRELIMINARY")} disabled={review.isPending}>
              {review.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {t("evaluations.approvePrelim")}
            </Button>
          )}
          {showFinal && (
            <Button onClick={() => act("FINAL")} disabled={review.isPending} className="bg-success hover:bg-success/90">
              {review.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              {t("evaluations.approveFinal")}
            </Button>
          )}
          {showReturn && (
            <Button variant="outline" onClick={() => setReturnOpen(true)} disabled={review.isPending}>
              <RotateCcw className="size-4" /> {t("evaluations.returnForEdit")}
            </Button>
          )}
        </div>
      )}

      {/* Removal is an oversight action (IT / الإدارة), so it stands apart from
          the reviewer's approve-reject pair and is available in any status. */}
      {canDelete && (
        <div className="flex justify-start border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={del.isPending}
          >
            <Trash2 className="size-4" /> {t("evaluations.deleteBtn")}
          </Button>
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("evaluations.deleteTitle")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("evaluations.deleteConfirm")}</p>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                try {
                  await del.mutateAsync(id);
                  toast.success(t("evaluations.deleted"));
                  router.push("/dashboard/evaluations");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : t("evaluations.deleteFailed"));
                }
              }}
            >
              {del.isPending && <Loader2 className="size-4 animate-spin" />}{" "}
              {t("evaluations.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("evaluations.returnReasonTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{t("evaluations.writeReturnReason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button onClick={returnForEdit} disabled={review.isPending}>
              {review.isPending && <Loader2 className="size-4 animate-spin" />} {t("evaluations.confirmReturn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
