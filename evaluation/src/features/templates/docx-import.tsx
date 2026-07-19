"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import type { TemplateQuestion } from "./use-templates";
import { useT } from "@/i18n/client";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_DOCX_BYTES = 5 * 1024 * 1024;

export interface TemplateDraft {
  title: string;
  questions: TemplateQuestion[];
  warnings: string[];
}

/**
 * Import an existing Word evaluation form into the builder: its criteria become
 * questions and its rating columns become their options.
 *
 * The parse fills the builder rather than saving, because a Word file is a
 * layout and the parse is a guess — the reviewer confirms or corrects it, and
 * nothing is written until they press save.
 */
export function DocxImport({
  onParsed,
}: {
  onParsed: (draft: TemplateDraft) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return toast.error(t("templates.mustBeDocx"));
    }
    if (file.size > MAX_DOCX_BYTES) {
      return toast.error(t("templates.tooLarge"));
    }

    setBusy(true);
    setWarnings([]);
    try {
      const form = new FormData();
      form.set("file", file);
      const draft = await apiClient.postForm<TemplateDraft>(
        "/api/templates/parse-docx",
        form,
      );
      onParsed(draft);
      setWarnings(draft.warnings);
      toast.success(t("templates.extracted", { n: draft.questions.length }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("templates.readFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" /> {t("templates.importFromWord")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("templates.importDesc")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={`.docx,${DOCX_MIME}`}
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            // Let the same file be picked again after a failed parse.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {t("templates.chooseWordFile")}
        </Button>

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3">
            {warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                {w}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
