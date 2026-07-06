"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useLookups, useEmployees } from "@/features/employees/use-employees";
import { useTemplate } from "@/features/templates/use-templates";
import { QuestionField, type AnswerValue } from "./question-field";
import { useCreateEvaluation } from "./use-evaluations";

export function EvaluationFill() {
  const router = useRouter();
  const { data: lookups } = useLookups();
  const { data: employeesPage } = useEmployees({ page: 1 });
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const { data: template, isLoading: loadingTemplate } = useTemplate(templateId || undefined);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const create = useCreateEvaluation();

  const employees = employeesPage?.items ?? [];

  async function save(submit: boolean) {
    if (!employeeId) return toast.error("اختر الموظف");
    if (!templateId) return toast.error("اختر النموذج");

    const payload = {
      templateId,
      employeeId,
      submit,
      answers: Object.entries(answers)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([questionId, value]) => ({ questionId, value })),
    };
    try {
      await create.mutateAsync(payload);
      toast.success(submit ? "تم إرسال التقييم للاعتماد" : "تم حفظ المسودة");
      router.push("/dashboard/evaluations");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">تقييم جديد</h1>

      <Card>
        <CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الموظف</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.employeeNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نموذج التقييم</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setAnswers({}); }}>
              <SelectTrigger><SelectValue placeholder="اختر النموذج" /></SelectTrigger>
              <SelectContent>
                {lookups?.templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
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
                    <div className="mt-2">
                      <QuestionField
                        question={q}
                        value={answers[q.id!]}
                        onChange={(v) => setAnswers((a) => ({ ...a, [q.id!]: v }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-start gap-3">
            <Button onClick={() => save(true)} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              إرسال للاعتماد
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={create.isPending}>
              <Save className="size-4" /> حفظ كمسودة
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
