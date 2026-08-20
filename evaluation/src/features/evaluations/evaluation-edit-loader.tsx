"use client";

import { Loader2 } from "lucide-react";
import { useEvaluation } from "./use-evaluations";
import { EvaluationFill } from "./evaluation-fill";
import { useT } from "@/i18n/client";

/**
 * Loads an existing evaluation and opens it in the fill form for editing. The
 * manager may edit while it is a draft or still in the employee dialogue; once
 * approved (locked) it is read-only. The server enforces ownership and status.
 */
export function EvaluationEditLoader({ id }: { id: string }) {
  const t = useT();
  const { data, isLoading } = useEvaluation(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-destructive">{t("evaluations.loadFailed")}</p>;
  }
  if (data.status === "APPROVED") {
    return <p className="py-20 text-center text-sm text-muted-foreground">{t("evaluations.notEditable")}</p>;
  }
  return <EvaluationFill initial={data} />;
}
