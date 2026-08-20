"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RECOMMENDATION_OPTIONS } from "@/core/domain/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useLookups } from "@/features/employees/use-employees";
import {
  EmployeeSearchCombobox,
  type PickerEmployee,
} from "@/features/employees/employee-search-combobox";
import { useTemplate } from "@/features/templates/use-templates";
import { QuestionField, type AnswerValue } from "./question-field";
import { useCreateEvaluation, useUpdateEvaluation, type EvaluationDetail } from "./use-evaluations";
import { useT } from "@/i18n/client";

/** Rebuild a form value from an evaluation's stored answer, per question type. */
function toFormValue(type: string, a: EvaluationDetail["answers"][number]): AnswerValue {
  switch (type) {
    case "STAR_RATING":
    case "NUMBER":
      return a.valueNumber ?? undefined;
    case "YES_NO":
      return a.valueBool ?? undefined;
    case "MULTIPLE_CHOICE":
    case "FILE_UPLOAD":
      return (a.valueJson as AnswerValue) ?? undefined;
    case "DATE":
      return a.valueDate ?? undefined;
    default:
      return a.valueText ?? undefined; // TEXT/TEXTAREA/TIME/SINGLE_CHOICE/DROPDOWN
  }
}

export function EvaluationFill({ initial }: { initial?: EvaluationDetail }) {
  const t = useT();
  const router = useRouter();
  const isEdit = !!initial;
  const { data: lookups } = useLookups();
  const [employee, setEmployee] = useState<PickerEmployee | null>(
    initial?.employee ? ({ ...initial.employee } as PickerEmployee) : null,
  );
  const [templateId, setTemplateId] = useState(initial?.template.id ?? "");
  const { data: template, isLoading: loadingTemplate } = useTemplate(templateId || undefined);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    if (!initial) return {};
    const typeById = new Map(initial.template.questions.map((q) => [q.id, q.type]));
    const res: Record<string, AnswerValue> = {};
    for (const a of initial.answers) {
      const type = typeById.get(a.questionId);
      if (type) res[a.questionId] = toFormValue(type, a);
    }
    return res;
  });
  const [remarks, setRemarks] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const res: Record<string, string> = {};
    for (const a of initial.answers) if (a.remarks) res[a.questionId] = a.remarks;
    return res;
  });
  const [recommendation, setRecommendation] = useState<string[]>(initial?.recommendation ?? []);
  const create = useCreateEvaluation();
  const update = useUpdateEvaluation(initial?.id ?? "");
  const pending = create.isPending || update.isPending;

  const toggleRec = (key: string) =>
    setRecommendation((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]));

  const employeeId = employee?.id ?? "";

  async function save(submit: boolean) {
    if (!employeeId) return toast.error(t("evaluations.chooseEmployee"));
    if (!templateId) return toast.error(t("evaluations.chooseTemplate"));

    // A question is sent when it has an answer OR a note — a remark written
    // without picking a grade is still worth keeping.
    const ids = new Set([
      ...Object.entries(answers)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([id]) => id),
      ...Object.entries(remarks)
        .filter(([, v]) => v.trim().length > 0)
        .map(([id]) => id),
    ]);
    const answersPayload = [...ids].map((questionId) => ({
      questionId,
      value: answers[questionId],
      remarks: remarks[questionId]?.trim() || null,
    }));

    try {
      if (isEdit && initial) {
        await update.mutateAsync({ answers: answersPayload, recommendation, submit });
      } else {
        await create.mutateAsync({ templateId, employeeId, submit, recommendation, answers: answersPayload });
      }
      toast.success(submit ? t("evaluations.sentForApproval") : t("evaluations.draftSaved"));
      router.push(isEdit && initial ? `/dashboard/evaluations/${initial.id}` : "/dashboard/evaluations");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.saveFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">
        {isEdit ? t("evaluations.editTitle") : t("evaluations.newTitle")}
      </h1>

      <Card>
        <CardHeader><CardTitle>{t("evaluations.basicData")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("evaluations.employeeLabel")}</Label>
            {isEdit ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                {employee?.name}
              </div>
            ) : (
              <EmployeeSearchCombobox value={employee} onSelect={setEmployee} />
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("evaluations.templateLabel")}</Label>
            {isEdit ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                {initial?.template.title}
              </div>
            ) : (
              <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setAnswers({}); }}>
                <SelectTrigger><SelectValue placeholder={t("evaluations.chooseTemplate")} /></SelectTrigger>
                <SelectContent>
                  {lookups?.templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.kind === "PROBATION" ? "🕐 [فترة تجربة] " : ""}
                      {tpl.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {loadingTemplate && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {template && (
        <>
          {template.questions.map((q, i) => (
            <Card key={q.id ?? i}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <Label className="text-base">
                      {q.label}
                      {q.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {q.helpText && (
                      <p className="mb-2 text-xs text-muted-foreground">{q.helpText}</p>
                    )}
                    {/* Answer and its note sit side by side on wide screens,
                        mirroring the «ملاحظات» column of the paper form, and
                        stack on mobile. */}
                    <div
                      className={
                        q.config?.allowRemarks
                          ? "mt-2 grid gap-3 md:grid-cols-[1fr_16rem]"
                          : "mt-2"
                      }
                    >
                      <QuestionField
                        question={q}
                        value={answers[q.id!]}
                        onChange={(v) => setAnswers((a) => ({ ...a, [q.id!]: v }))}
                      />
                      {q.config?.allowRemarks && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("evaluations.remarks")}
                          </Label>
                          <Textarea
                            rows={4}
                            value={remarks[q.id!] ?? ""}
                            onChange={(e) =>
                              setRemarks((r) => ({ ...r, [q.id!]: e.target.value }))
                            }
                            placeholder={t("evaluations.remarksPlaceholder")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* «التوصية» — fixed for every employee, seen by reviewers/management
              only. Explicitly NOT shown to the employee in their copy. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("evaluations.recommendation")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("evaluations.recommendationHint")}</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {RECOMMENDATION_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/40"
                >
                  <div className="text-sm">
                    <span className="font-medium">{opt.ar}</span>
                    <span className="ms-2 text-xs text-muted-foreground">{opt.en}</span>
                  </div>
                  <Switch
                    checked={recommendation.includes(opt.key)}
                    onCheckedChange={() => toggleRec(opt.key)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-start gap-3">
            <Button onClick={() => save(true)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("evaluations.submitForApproval")}
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={pending}>
              <Save className="size-4" /> {t("evaluations.saveDraft")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
