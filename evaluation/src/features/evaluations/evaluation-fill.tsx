"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Save, FileText, Upload, X, ListChecks } from "lucide-react";
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
import { useLookups } from "@/features/employees/use-employees";
import {
  EmployeeSearchCombobox,
  type PickerEmployee,
} from "@/features/employees/employee-search-combobox";
import { useTemplate } from "@/features/templates/use-templates";
import { QuestionField, type AnswerValue } from "./question-field";
import { useCreateEvaluation, useUploadEvaluation } from "./use-evaluations";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_DOCX_BYTES = 5 * 1024 * 1024;

type Mode = "form" | "document";

export function EvaluationFill() {
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [mode, setMode] = useState<Mode>("form");
  const [employee, setEmployee] = useState<PickerEmployee | null>(null);
  const [templateId, setTemplateId] = useState("");
  const { data: template, isLoading: loadingTemplate } = useTemplate(
    mode === "form" && templateId ? templateId : undefined,
  );
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const create = useCreateEvaluation();
  const upload = useUploadEvaluation();

  const employeeId = employee?.id ?? "";
  const busy = create.isPending || upload.isPending;

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    // Mirrors the server's checks so the user hears about a bad file instantly
    // rather than after uploading it. The server still re-checks.
    if (!picked.name.toLowerCase().endsWith(".docx")) {
      return toast.error("الملف يجب أن يكون بصيغة Word‏ (.docx)");
    }
    if (picked.size > MAX_DOCX_BYTES) {
      return toast.error("حجم الملف يتجاوز 5 ميجابايت");
    }
    setFile(picked);
  }

  async function saveDocument(submit: boolean) {
    if (!employeeId) return toast.error("اختر الموظف");
    if (!file) return toast.error("اختر ملف الوورد");
    try {
      await upload.mutateAsync({ file, employeeId, submit });
      toast.success(submit ? "تم إرسال التقييم للاعتماد" : "تم حفظ المسودة");
      router.push("/dashboard/evaluations");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر رفع الملف");
    }
  }

  async function save(submit: boolean) {
    if (mode === "document") return saveDocument(submit);
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("form")}
          aria-pressed={mode === "form"}
          className={`flex items-center gap-3 rounded-lg border p-4 text-start transition ${
            mode === "form"
              ? "border-primary bg-accent ring-2 ring-primary/30"
              : "hover:bg-accent/50"
          }`}
        >
          <ListChecks className="size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">تعبئة نموذج</p>
            <p className="text-xs text-muted-foreground">إجابة أسئلة التقييم</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("document")}
          aria-pressed={mode === "document"}
          className={`flex items-center gap-3 rounded-lg border p-4 text-start transition ${
            mode === "document"
              ? "border-primary bg-accent ring-2 ring-primary/30"
              : "hover:bg-accent/50"
          }`}
        >
          <FileText className="size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">رفع ملف وورد</p>
            <p className="text-xs text-muted-foreground">الملف نفسه يصبح التقييم</p>
          </div>
        </button>
      </div>

      <Card>
        <CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>الموظف</Label>
            <EmployeeSearchCombobox value={employee} onSelect={setEmployee} />
          </div>
          {mode === "form" && (
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
          )}
        </CardContent>
      </Card>

      {mode === "document" && (
        <>
          <Card>
            <CardHeader><CardTitle>ملف التقييم</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={`.docx,${DOCX_MIME}`}
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  // Allow re-picking the same file after removing it.
                  e.target.value = "";
                }}
              />
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <FileText className="size-8 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} كيلوبايت
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="إزالة الملف"
                    onClick={() => setFile(null)}
                    disabled={busy}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  <Upload className="size-7" />
                  <span className="text-sm font-medium">اضغط لاختيار ملف Word‏ (.docx)</span>
                  <span className="text-xs">الحد الأقصى ٥ ميجابايت</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                سيتم عرض محتوى الملف كما هو داخل التقييم، ويعتمده المدير مباشرة.
                الصور داخل الملف لا تُحفظ.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-start gap-3">
            <Button onClick={() => save(true)} disabled={busy || !file}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              إرسال للاعتماد
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={busy || !file}>
              <Save className="size-4" /> حفظ كمسودة
            </Button>
          </div>
        </>
      )}

      {mode === "form" && loadingTemplate && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {mode === "form" && template && (
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
            <Button onClick={() => save(true)} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              إرسال للاعتماد
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={busy}>
              <Save className="size-4" /> حفظ كمسودة
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
