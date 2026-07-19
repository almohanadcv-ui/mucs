"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QuestionType } from "@/core/domain/enums";
import { StarRating } from "./star-rating";
import type { TemplateQuestion } from "@/features/templates/use-templates";
import { useT } from "@/i18n/client";

export type AnswerValue = unknown;

export function QuestionField({
  question,
  value,
  onChange,
}: {
  question: TemplateQuestion;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const t = useT();
  const cfg = question.config ?? {};

  switch (question.type) {
    case QuestionType.STAR_RATING:
      return (
        <StarRating
          max={cfg.max ?? 5}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
        />
      );

    case QuestionType.YES_NO:
      return (
        <div className="flex gap-2">
          {[
            { v: true, label: t("evaluations.yes") },
            { v: false, label: t("evaluations.no") },
          ].map((o) => (
            <Button
              key={String(o.v)}
              type="button"
              variant={value === o.v ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(o.v)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      );

    case QuestionType.SINGLE_CHOICE:
      return (
        <div className="space-y-2">
          {(cfg.options ?? []).map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                value === o.value ? "border-primary bg-accent" : "hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                className="accent-[hsl(var(--primary))]"
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );

    case QuestionType.MULTIPLE_CHOICE: {
      const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {(cfg.options ?? []).map((o) => {
            const checked = arr.includes(o.value);
            return (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked ? "border-primary bg-accent" : "hover:bg-muted/40",
                )}
              >
                <input
                  type="checkbox"
                  className="accent-[hsl(var(--primary))]"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked ? arr.filter((x) => x !== o.value) : [...arr, o.value],
                    )
                  }
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }

    case QuestionType.DROPDOWN:
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("evaluations.choosePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(cfg.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case QuestionType.NUMBER:
      return (
        <Input
          type="number" dir="ltr" className="max-w-40"
          min={cfg.min} max={cfg.numberMax}
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case QuestionType.TEXT:
      return (
        <Input
          maxLength={cfg.maxLength}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QuestionType.TEXTAREA:
      return (
        <Textarea
          maxLength={cfg.maxLength}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QuestionType.DATE:
      return (
        <Input
          type="date" dir="ltr" className="max-w-48"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QuestionType.TIME:
      return (
        <Input
          type="time" dir="ltr" className="max-w-40"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QuestionType.FILE_UPLOAD:
      return (
        <div className="space-y-2">
          <Input
            type="file"
            accept={cfg.accept?.map((a) => `.${a}`).join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return onChange(null);
              const maxBytes = (cfg.maxSizeMB ?? 5) * 1024 * 1024;
              if (f.size > maxBytes) {
                onChange(null);
                return;
              }
              onChange({ name: f.name, size: f.size, mime: f.type });
            }}
          />
          {value != null && typeof value === "object" && (
            <p className="text-xs text-muted-foreground">
              {(value as { name: string }).name}
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
