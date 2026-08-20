"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Check, CheckCheck, Star, Trash2, Download, Pencil, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { QuestionType, RECOMMENDATION_OPTIONS } from "@/core/domain/enums";
import { useMe } from "@/features/auth/use-me";
import { EvaluationStatusBadge } from "@/features/dashboard/status-badges";
import {
  useEvaluation,
  useApproveEvaluation,
  useDeleteEvaluation,
  useEvaluationComments,
  useAddEvaluationComment,
  type EvaluationDetail,
} from "./use-evaluations";
import { useI18n } from "@/i18n/client";

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** States where the evaluation is still in the manager↔employee dialogue. */
const OPEN_STATES = ["SENT_TO_EMPLOYEE", "EMPLOYEE_RESPONDED", "EMPLOYEE_ACKNOWLEDGED"];
const EDITABLE_STATES = ["DRAFT", "NEEDS_EDIT", ...OPEN_STATES];

const AUTHOR_LABEL: Record<string, string> = {
  MANAGER: "المدير",
  EMPLOYEE: "الموظف",
  HR: "الموارد البشرية",
};

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
  canDelete,
  canHrNote,
  canViewThread,
}: {
  id: string;
  /** kept for compatibility (any review capability) */
  canReview?: boolean;
  /** IT / الإدارة may remove an evaluation entirely. */
  canDelete?: boolean;
  /** HR may leave an internal feedback note on the manager. */
  canHrNote?: boolean;
  /** HR / IT / الإدارة see the full conversation archive. */
  canViewThread?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data, isLoading } = useEvaluation(id);
  const approve = useApproveEvaluation(id);
  const del = useDeleteEvaluation();
  const addComment = useAddEvaluationComment(id);
  const { data: me } = useMe();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [reply, setReply] = useState("");

  const isOwner = !!me && !!data && me.id === data.evaluator?.id;
  const showThread = Boolean(canViewThread) || isOwner;
  const { data: comments } = useEvaluationComments(showThread ? id : undefined);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-destructive">{t("evaluations.loadFailed")}</p>;
  }

  const answersByQ = new Map(data.answers.map((a) => [a.questionId, a]));
  const status = data.status;
  const locked = status === "APPROVED";
  const canApprove = isOwner && OPEN_STATES.includes(status);
  const canEdit = isOwner && EDITABLE_STATES.includes(status);
  const canReply = isOwner && !locked; // manager reply (visible to employee)
  const canAddHrNote = Boolean(canHrNote) && !isOwner && !locked; // internal HR note

  async function doApprove() {
    try {
      await approve.mutateAsync();
      toast.success("تم اعتماد التقييم نهائيًا وإرساله للموظف.");
      setConfirmApprove(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الاعتماد.");
    }
  }

  async function sendComment() {
    if (reply.trim().length < 1) return;
    try {
      await addComment.mutateAsync(reply.trim());
      setReply("");
      toast.success(canAddHrNote && !isOwner ? "تمت إضافة ملاحظتك." : "تم إرسال ردّك.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الإرسال.");
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

      {status === "SENT_TO_EMPLOYEE" && isOwner && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          أُرسل التقييم للموظف على بريده، بانتظار اطّلاعه وملاحظاته.
        </div>
      )}
      {status === "EMPLOYEE_RESPONDED" && isOwner && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          أبدى الموظف ملاحظات — راجع المحادثة بالأسفل، وعدّل التقييم إن لزم ثم أعد الإرسال، أو اعتمده.
        </div>
      )}
      {status === "EMPLOYEE_ACKNOWLEDGED" && isOwner && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          وافق الموظف على التقييم. يمكنك اعتماده نهائيًا.
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

      {data.recommendation && data.recommendation.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("evaluations.recommendation")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("evaluations.recommendationConfidential")}</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {RECOMMENDATION_OPTIONS.filter((o) => data.recommendation.includes(o.key)).map((o) => (
              <span key={o.key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Check className="size-3.5" /> {o.ar}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {data.overallNote && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">ملاحظة</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{data.overallNote}</p>
          </CardContent>
        </Card>
      )}

      {/* Conversation thread (manager replies, employee messages, internal HR notes). */}
      {showThread && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" /> المحادثة والملاحظات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(comments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
            )}
            {(comments ?? []).map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-3 text-sm ${
                  c.authorType === "HR"
                    ? "border-amber-300/50 bg-amber-50 dark:bg-amber-950/20"
                    : c.authorType === "EMPLOYEE"
                      ? "border-sky-300/50 bg-sky-50 dark:bg-sky-950/20"
                      : "border-border bg-muted/40"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">
                    {AUTHOR_LABEL[c.authorType] ?? c.authorName}
                    {c.authorType === "HR" && !c.visibleToEmployee && " (داخلي)"}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>
                </div>
                <div className="whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}

            {(canReply || canAddHrNote) && (
              <div className="space-y-2 pt-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={
                    canAddHrNote && !isOwner
                      ? "اكتب ملاحظتك الداخلية للمدير (لا يراها الموظف)…"
                      : "اكتب ردّك للموظف…"
                  }
                />
                <Button onClick={sendComment} disabled={addComment.isPending || reply.trim().length < 1}>
                  {addComment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {canAddHrNote && !isOwner ? "إضافة ملاحظة" : "إرسال الرد"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-start gap-3">
        {canEdit && (
          <Button asChild variant={status === "EMPLOYEE_RESPONDED" ? "default" : "outline"}>
            <Link href={`/dashboard/evaluations/${id}/edit`}>
              <Pencil className="size-4" /> {t("evaluations.editAndResend")}
            </Link>
          </Button>
        )}
        {canApprove && (
          <Button onClick={() => setConfirmApprove(true)} disabled={approve.isPending} className="bg-success hover:bg-success/90">
            {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            اعتماد نهائي
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href={`/api/evaluations/${id}/pdf`}>
            <Download className="size-4" /> {t("evaluations.downloadPdf")}
          </a>
        </Button>
      </div>

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

      <Dialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>اعتماد التقييم نهائيًا</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            بعد الاعتماد يُقفل التقييم ويُلغى رابط الموظف، وتصله النسخة النهائية على بريده. لا يمكن التراجع.
          </p>
          <DialogFooter>
            <Button className="bg-success hover:bg-success/90" disabled={approve.isPending} onClick={doApprove}>
              {approve.isPending && <Loader2 className="size-4 animate-spin" />} تأكيد الاعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
