"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { ChevronRight } from "lucide-react";
import {
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatusValue,
} from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { transitionMaintenanceRequest } from "./api";

// Mirrors apps/api/src/modules/workflow/transitions.ts — kept as a small,
// manually-synced constant here since the frontend just needs the shape of
// the graph for the "move to" menu, not runtime permission enforcement
// (the API is the real authority and will reject anything not allowed).
const NEXT_STATES: Record<MaintenanceStatusValue, MaintenanceStatusValue[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["CANCELLED"], // approval itself happens via the decision panel
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function StatusMoveMenu({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: MaintenanceStatusValue;
}) {
  const queryClient = useQueryClient();
  const nextStates = NEXT_STATES[currentStatus];

  const mutation = useMutation({
    mutationFn: (toStatus: MaintenanceStatusValue) => transitionMaintenanceRequest(requestId, toStatus),
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "تعذّر تغيير الحالة"
        : "تعذّر تغيير الحالة";
      toast.error(message);
    },
  });

  if (nextStates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs">
          نقل إلى <ChevronRight className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {nextStates.map((status) => (
          <DropdownMenuItem key={status} onClick={() => mutation.mutate(status)}>
            {MAINTENANCE_STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
