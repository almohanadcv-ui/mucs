"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X, Star, FileText } from "lucide-react";
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
import { QuestionType, STAR_RATING_LABELS } from "@/core/domain/enums";
import { EvaluationStatusBadge } from "@/features/dashboard/status-badges";
import { useEvaluation, useReviewEvaluation, type EvaluationDetail } from "./use-evaluations";

function formatAnswer(
  question: NonNullable<EvaluationDetail["template"]>["questions"][number],
  answer: EvaluationDetail["answers"][number] | undefined,
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
          {(cfg.max ?? 5) === 5 && <span className="text-xs text-muted-foreground">{STAR_RATING_LABELS[n]}</span>}
        </span>
      );
    }
    case QuestionType.YES_NO:
      return answer.valueBool ? "نعم" : "لا";
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.DROPDOWN:
      return cfg.options?.find((o) => o.value === answer.valueText)?.label ?? answer.valueText;
    case QuestionType.MULTIPLE_CHOICE: {
      const arr = Array.isArray(answer.valueJson) ? (answer.valueJson as string[]) : [];
      return arr.map((v) => cfg.options?.find((o) => o.value === v)?.label ?? v).join("، ");
    }
    case QuestionType.NUMBER:
      return answer.valueNumber ?? "—";
    case QuestionType.DATE:
      return answer.valueDate ? new Date(answer.valueDate).toLocaleDateString("ar-EG") : "—";
    case QuestionType.FILE_UPLOAD:
      return (answer.valueJson as { name?: string } | null)?.name ?? "ملف";
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
  const { data, isLoading } = useEvaluation(id);
  const review = useReviewEvaluation(id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-destructive">تعذّر تحميل التقييم.</p>;
  }

  const answersByQ = new Map(data.answers.map((a) => [a.questionId, a]));
  const isPending = data.status === "PENDING";

  async function approve() {
    try {
      await review.mutateAsync({ decision: "APPROVE" });
      toast.success("تم اعتماد التقييم");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الاعتماد");
    }
  }
  async function reject() {
    if (reason.trim().length < 3) return toast.error("سبب الرفض مطلوب");
    try {
      await review.mutateAsync({ decision: "REJECT", reason: reason.trim() });
      toast.success("تم رفض التقييم");
      setRejectOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الرفض");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {data.source === "DOCUMENT"
              ? (data.documentName ?? "تقييم بملف وورد")
              : (data.template?.title ?? "تقييم")}
          </h1>
          <p className="text-sm text-muted-foreground">
            الموظف: {data.employee?.name} · المقيّم: {data.evaluator?.name}
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
          سبب الرفض: {data.rejectionReason}
        </div>
      )}

      {data.source === "DOCUMENT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" /> محتوى ملف التقييم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Sanitized on ingest in docxToSafeHtml — the server is the trust
                boundary for this markup, never the client. */}
            <div
              className="evaluation-document"
              dangerouslySetInnerHTML={{ __html: data.documentHtml ?? "" }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>الإجابات</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.template?.questions.map((q, i) => (
              <div key={q.id ?? i} className="flex items-start justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground">{i + 1}. {q.label}</span>
                <span className="text-sm font-medium">{formatAnswer(q, answersByQ.get(q.id!))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canReview && isPending && (
        <div className="flex justify-start gap-3">
          <Button onClick={approve} disabled={review.isPending}>
            {review.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            اعتماد
          </Button>
          <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={review.isPending}>
            <X className="size-4" /> رفض
          </Button>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>سبب الرفض</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>اكتب سبب رفض التقييم</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={reject} disabled={review.isPending}>
              {review.isPending && <Loader2 className="size-4 animate-spin" />} تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
