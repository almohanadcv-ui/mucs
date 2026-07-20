"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCreateEvaluation } from "./use-evaluations";
import { useT } from "@/i18n/client";

export function EvaluationFill() {
  const t = useT();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [employee, setEmployee] = useState<PickerEmployee | null>(null);
  const [templateId, setTemplateId] = useState("");
  const { data: template, isLoading: loadingTemplate } = useTemplate(templateId || undefined);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const create = useCreateEvaluation();

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

    const payload = {
      templateId,
      employeeId,
      submit,
      answers: [...ids].map((questionId) => ({
        questionId,
        value: answers[questionId],
        remarks: remarks[questionId]?.trim() || null,
      })),
    };
    try {
      await create.mutateAsync(payload);
      toast.success(submit ? t("evaluations.sentForApproval") : t("evaluations.draftSaved"));
      router.push("/dashboard/evaluations");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("evaluations.saveFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t("evaluations.newTitle")}</h1>

      <Card>
        <CardHeader><CardTitle>{t("evaluations.basicData")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("evaluations.employeeLabel")}</Label>
            <EmployeeSearchCombobox value={employee} onSelect={setEmployee} />
          </div>
          <div className="space-y-2">
            <Label>{t("evaluations.templateLabel")}</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setAnswers({}); }}>
              <SelectTrigger><SelectValue placeholder={t("evaluations.chooseTemplate")} /></SelectTrigger>
              <SelectContent>
                {lookups?.templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>{tpl.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="flex justify-start gap-3">
            <Button onClick={() => save(true)} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("evaluations.submitForApproval")}
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={create.isPending}>
              <Save className="size-4" /> {t("evaluations.saveDraft")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
