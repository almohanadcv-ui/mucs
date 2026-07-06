"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { ChevronRight } from "lucide-react";
import type { MaintenanceStatusValue } from "@mica-mab/shared-types";
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
  REPORTED: ["IN_PROGRESS", "CANCELLED"],
  PENDING_APPROVAL: [],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  SCHEDULED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "QUALITY_INSPECTION", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_INSPECTION: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["DELIVERED"],
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
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Transition failed"
        : "Transition failed";
      toast.error(message);
    },
  });

  if (nextStates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          Move to <ChevronRight className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {nextStates.map((status) => (
          <DropdownMenuItem key={status} onClick={() => mutation.mutate(status)}>
            {status.replace(/_/g, " ")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
