"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { QUESTION_TYPE_META, metaFor } from "./question-types";
import { DocxImport, type TemplateDraft } from "./docx-import";
import {
  useCreateTemplate,
  useUpdateTemplate,
  type TemplateDetail,
  type TemplateQuestion,
} from "./use-templates";

interface LocalQuestion extends TemplateQuestion {
  _key: string;
}

function blankQuestion(order: number): LocalQuestion {
  return {
    _key: nanoid(),
    type: "STAR_RATING",
    label: "",
    required: true,
    order,
    config: { max: 5, weight: 1 },
  };
}

export function TemplateBuilder({ initial }: { initial?: TemplateDetail }) {
  const router = useRouter();
  const isEdit = !!initial;
  const create = useCreateTemplate();
  const update = useUpdateTemplate(initial?.id ?? "");
  const pending = create.isPending || update.isPending;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [questions, setQuestions] = useState<LocalQuestion[]>(
    initial?.questions.map((q) => ({ ...q, _key: nanoid() })) ?? [blankQuestion(0)],
  );

  /** Fill the builder from a parsed Word form, replacing what is on screen. */
  function applyDraft(draft: TemplateDraft) {
    if (draft.title) setTitle(draft.title);
    setQuestions(draft.questions.map((q) => ({ ...q, _key: nanoid() })));
  }

  function patchQuestion(key: string, patch: Partial<LocalQuestion>) {
    setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, ...patch } : q)));
  }
  function patchConfig(key: string, patch: Record<string, unknown>) {
    setQuestions((qs) =>
      qs.map((q) => (q._key === key ? { ...q, config: { ...q.config, ...patch } } : q)),
    );
  }
  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion(qs.length)]);
  }
  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q._key !== key));
  }
  function move(key: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q._key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function onSubmit() {
    if (!title.trim()) return toast.error("عنوان النموذج مطلوب");
    if (questions.length === 0) return toast.error("أضف سؤالاً واحداً على الأقل");

    for (const q of questions) {
      if (!q.label.trim()) return toast.error("كل سؤال يحتاج نصاً");
      if (metaFor(q.type).hasOptions && (q.config?.options?.length ?? 0) < 2) {
        return toast.error(`السؤال «${q.label}» يحتاج خيارين على الأقل`);
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      isActive,
      questions: questions.map((q, i) => ({
        type: q.type,
        label: q.label.trim(),
        helpText: q.helpText || null,
        required: q.required,
        order: i,
        config: q.config ?? undefined,
      })),
    };

    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        toast.success("تم حفظ النموذج");
      } else {
        await create.mutateAsync(payload);
        toast.success("تم إنشاء النموذج");
      }
      router.push("/dashboard/templates");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isEdit ? "تعديل نموذج تقييم" : "نموذج تقييم جديد"}
        </h1>
        <Button onClick={onSubmit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ
        </Button>
      </div>

      {/* Import is offered on new templates only: dropping a parsed file over an
          existing template would silently discard questions that evaluations
          already point at. */}
      {!isEdit && <DocxImport onParsed={applyDraft} />}

      <Card>
        <CardHeader>
          <CardTitle>معلومات النموذج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تقييم شهري" />
          </div>
          <div className="space-y-2">
            <Label>الوصف (اختياري)</Label>
            <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
            <Label htmlFor="active">مفعّل</Label>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q._key}
            index={i}
            question={q}
            onChange={(patch) => patchQuestion(q._key, patch)}
            onConfig={(patch) => patchConfig(q._key, patch)}
            onRemove={() => removeQuestion(q._key)}
            onMoveUp={() => move(q._key, -1)}
            onMoveDown={() => move(q._key, 1)}
          />
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={addQuestion}>
        <Plus className="size-4" /> إضافة سؤال
      </Button>

      <ScoringSummary questions={questions} />
    </div>
  );
}

/**
 * Live scoring breakdown. The final score (0–100) is the WEIGHTED AVERAGE of the
 * "scoreable" questions only: each answer is normalized to 0..1, multiplied by
 * its weight, summed, divided by the total weight, ×100.
 */
function ScoringSummary({ questions }: { questions: LocalQuestion[] }) {
  const scoreable = questions.filter((q) => metaFor(q.type).scoreable && q.label.trim());
  const totalWeight = scoreable.reduce((s, q) => s + (q.config?.weight ?? 1), 0);

  return (
    <Card className="border-primary/30 bg-accent/30">
      <CardHeader>
        <CardTitle className="text-base">كيف تُحتسب النتيجة؟</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          النتيجة النهائية (0–100) = المتوسط <b>الموزون</b> للأسئلة القابلة للتقييم.
          كل إجابة تُحوّل إلى نسبة 0–1 (نجوم: القيمة÷العدد، نعم=1/لا=0، رقم: القيمة÷الأقصى،
          الاختيارات: نقاط الخيار)، ثم: <span dir="ltr" className="font-mono">Σ(نسبة×وزن) ÷ Σ(الأوزان) × 100</span>.
          الأسئلة النصية والتاريخ والملفات لا تدخل في الحساب.
        </p>
        {scoreable.length === 0 ? (
          <p className="text-muted-foreground">لا توجد أسئلة قابلة للتقييم بعد.</p>
        ) : (
          <div className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="px-3 py-2 font-medium">السؤال</th>
                  <th className="px-3 py-2 font-medium">الوزن</th>
                  <th className="px-3 py-2 font-medium">نسبة المساهمة</th>
                </tr>
              </thead>
              <tbody>
                {scoreable.map((q) => {
                  const w = q.config?.weight ?? 1;
                  const pct = totalWeight > 0 ? Math.round((w / totalWeight) * 1000) / 10 : 0;
                  return (
                    <tr key={q._key} className="border-b last:border-0">
                      <td className="px-3 py-2">{q.label}</td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{w}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="px-3 py-2">الإجمالي</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">{totalWeight}</td>
                  <td className="px-3 py-2 text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionCard({
  index,
  question,
  onChange,
  onConfig,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  question: LocalQuestion;
  onChange: (patch: Partial<LocalQuestion>) => void;
  onConfig: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = metaFor(question.type);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-2">
          <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <div className="space-y-1">
                <Label className="text-xs">السؤال {index + 1}</Label>
                <Input
                  value={question.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="نص السؤال"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">النوع</Label>
                <Select
                  value={question.type}
                  onValueChange={(type) =>
                    onChange({ type, config: defaultConfigFor(type) })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPE_META.map((m) => (
                      <SelectItem key={m.type} value={m.type}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <QuestionConfigEditor question={question} onConfig={onConfig} />

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={question.required}
                  onCheckedChange={(v) => onChange({ required: v })}
                  id={`req-${question._key}`}
                />
                <Label htmlFor={`req-${question._key}`} className="text-xs">مطلوب</Label>
              </div>
              {meta.scoreable && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">الوزن</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-20"
                    dir="ltr"
                    value={question.config?.weight ?? 1}
                    onChange={(e) => onConfig({ weight: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={onMoveUp}>
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onMoveDown}>
              <ArrowDown className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={onRemove}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function defaultConfigFor(type: string): LocalQuestion["config"] {
  const meta = metaFor(type);
  if (type === "STAR_RATING") return { max: 5, weight: 1 };
  if (meta.hasOptions)
    return { weight: 1, options: [
      { value: "opt1", label: "خيار 1", score: 1 },
      { value: "opt2", label: "خيار 2", score: 0.5 },
    ] };
  if (type === "NUMBER") return { weight: 1, numberMax: 100 };
  if (type === "FILE_UPLOAD") return { maxSizeMB: 5, accept: ["pdf", "png", "jpg"] };
  return { weight: 1 };
}

function QuestionConfigEditor({
  question,
  onConfig,
}: {
  question: LocalQuestion;
  onConfig: (patch: Record<string, unknown>) => void;
}) {
  const meta = metaFor(question.type);
  const cfg = question.config ?? {};

  if (question.type === "STAR_RATING") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs">عدد النجوم</Label>
        <Input
          type="number" min={3} max={10} dir="ltr" className="h-8 w-20"
          value={cfg.max ?? 5}
          onChange={(e) => onConfig({ max: Number(e.target.value) })}
        />
      </div>
    );
  }

  if (question.type === "NUMBER") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">أدنى</Label>
          <Input type="number" dir="ltr" className="h-8 w-24"
            value={cfg.min ?? ""} onChange={(e) => onConfig({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">أقصى (للتقييم)</Label>
          <Input type="number" dir="ltr" className="h-8 w-24"
            value={cfg.numberMax ?? ""} onChange={(e) => onConfig({ numberMax: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
      </div>
    );
  }

  if (question.type === "TEXT" || question.type === "TEXTAREA") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs">أقصى عدد أحرف</Label>
        <Input type="number" dir="ltr" className="h-8 w-28"
          value={cfg.maxLength ?? ""} onChange={(e) => onConfig({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })} />
      </div>
    );
  }

  if (meta.hasOptions) {
    const options = cfg.options ?? [];
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Label className="text-xs">الخيارات (النقاط 0–1 تُحتسب في التقييم)</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-8 flex-1" placeholder="النص المعروض"
              value={opt.label}
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...opt, label: e.target.value, value: opt.value || `opt${i + 1}` };
                onConfig({ options: next });
              }}
            />
            <Input
              className="h-8 w-24" type="number" min={0} max={1} step={0.1} dir="ltr" placeholder="نقاط"
              value={opt.score ?? ""}
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...opt, score: e.target.value === "" ? undefined : Number(e.target.value) };
                onConfig({ options: next });
              }}
            />
            <Button variant="ghost" size="icon" className="size-8 text-destructive"
              onClick={() => onConfig({ options: options.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm"
          onClick={() => onConfig({ options: [...options, { value: `opt${options.length + 1}`, label: "", score: undefined }] })}>
          <Plus className="size-4" /> خيار
        </Button>
      </div>
    );
  }

  return null;
}
