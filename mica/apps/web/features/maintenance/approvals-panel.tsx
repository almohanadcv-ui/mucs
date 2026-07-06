"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { decideApproval, getMaintenanceApprovals } from "./api";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export function ApprovalsPanel({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("maintenance");
  const canApprove = usePermission("maintenance:approve");
  const [comment, setComment] = useState("");

  const { data: approvals } = useQuery({
    queryKey: ["maintenance", requestId, "approvals"],
    queryFn: () => getMaintenanceApprovals(requestId),
  });

  const mutation = useMutation({
    mutationFn: ({ level, decision }: { level: number; decision: "APPROVED" | "REJECTED" }) =>
      decideApproval(requestId, level, decision, comment || undefined),
    onSuccess: () => {
      toast.success(t("approvalDecisionRecorded"));
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("approvalDecisionFailed")
        : t("approvalDecisionFailed");
      toast.error(message);
    },
  });

  if (!approvals?.length) return <p className="text-sm text-muted-foreground">{t("noApprovalsRequired")}</p>;

  const nextPendingLevel = approvals.find((a) => a.status === "PENDING")?.level;

  return (
    <div className="space-y-3">
      {approvals.map((approval) => (
        <div key={approval.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{t("approvalLevel", { level: approval.level })}</p>
            {approval.comment && <p className="text-xs text-muted-foreground">{approval.comment}</p>}
          </div>
          <Badge variant={STATUS_VARIANT[approval.status]}>{t(`approvalStatuses.${approval.status}`)}</Badge>
        </div>
      ))}

      {canApprove && nextPendingLevel && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{t("managerDecision")}</p>
          <Input
            placeholder={t("decisionCommentPlaceholder")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => mutation.mutate({ level: nextPendingLevel, decision: "APPROVED" })}
              disabled={mutation.isPending}
            >
              {t("approveRequest")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => mutation.mutate({ level: nextPendingLevel, decision: "REJECTED" })}
              disabled={mutation.isPending}
            >
              {t("rejectRequest")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
