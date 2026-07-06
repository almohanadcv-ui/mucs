import { Badge } from "@/components/ui/badge";
import { EmployeeStatus, EvaluationStatus } from "@/core/domain/enums";

const EVAL: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
  [EvaluationStatus.DRAFT]: { label: "مسودة", variant: "muted" },
  [EvaluationStatus.PENDING]: { label: "بانتظار الاعتماد", variant: "warning" },
  [EvaluationStatus.APPROVED]: { label: "معتمد", variant: "success" },
  [EvaluationStatus.REJECTED]: { label: "مرفوض", variant: "destructive" },
};

const EMP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
  [EmployeeStatus.ACTIVE]: { label: "نشط", variant: "success" },
  [EmployeeStatus.INACTIVE]: { label: "غير نشط", variant: "muted" },
  [EmployeeStatus.ON_LEAVE]: { label: "في إجازة", variant: "warning" },
  [EmployeeStatus.TERMINATED]: { label: "منتهي", variant: "destructive" },
};

export function EvaluationStatusBadge({ status }: { status: string }) {
  const s = EVAL[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function EmployeeStatusBadge({ status }: { status: string }) {
  const s = EMP[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
