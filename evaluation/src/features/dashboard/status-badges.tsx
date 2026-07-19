"use client";

import { Badge } from "@/components/ui/badge";
import { EmployeeStatus, EvaluationStatus } from "@/core/domain/enums";
import { useT } from "@/i18n/client";

type Variant = "success" | "warning" | "destructive" | "muted";

const EVAL_VARIANT: Record<string, Variant> = {
  [EvaluationStatus.DRAFT]: "muted",
  [EvaluationStatus.PENDING]: "warning",
  [EvaluationStatus.APPROVED]: "success",
  [EvaluationStatus.REJECTED]: "destructive",
};

const EMP_VARIANT: Record<string, Variant> = {
  [EmployeeStatus.ACTIVE]: "success",
  [EmployeeStatus.INACTIVE]: "muted",
  [EmployeeStatus.ON_LEAVE]: "warning",
  [EmployeeStatus.TERMINATED]: "destructive",
};

export function EvaluationStatusBadge({ status }: { status: string }) {
  const t = useT();
  const variant = EVAL_VARIANT[status] ?? "muted";
  const label = EVAL_VARIANT[status] ? t(`evalStatus.${status}`) : status;
  return <Badge variant={variant}>{label}</Badge>;
}

export function EmployeeStatusBadge({ status }: { status: string }) {
  const t = useT();
  const variant = EMP_VARIANT[status] ?? "muted";
  const label = EMP_VARIANT[status] ? t(`empStatus.${status}`) : status;
  return <Badge variant={variant}>{label}</Badge>;
}
