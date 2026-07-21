"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteMaintenanceCostGroup, type MaintenanceCostQuery } from "./api";

/**
 * Deletes a whole row of the maintenance-cost report.
 *
 * A row is an aggregate, so this is a bulk delete of everything it counts —
 * the confirmation names the count explicitly, because "delete this row" hides
 * how much is actually going. Deletion is soft: each request is restorable
 * individually from Trash.
 *
 * Gated by the caller via `maintenance:delete`.
 */
export function ReportRowDeleteButton({
  query,
  groupId,
  groupLabel,
  requestCount,
}: {
  query: MaintenanceCostQuery;
  groupId: string;
  groupLabel: string;
  requestCount: number;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteMaintenanceCostGroup(query, groupId),
    onSuccess: ({ deleted, skipped }) => {
      // A partial result is the normal case for a role that may not delete
      // approved work, so it is reported rather than glossed as success.
      if (skipped > 0) {
        toast.warning(`حُذف ${deleted} طلبًا، وتُخطّي ${skipped} لا تملك صلاحية حذفها`);
      } else {
        toast.success(`تم نقل ${deleted} طلبًا إلى المحذوفات`);
      }
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setOpen(false);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر الحذف")
        : "تعذّر الحذف";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive print:hidden"
          aria-label={`حذف طلبات ${groupLabel}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف صف التقرير</DialogTitle>
          <DialogDescription>
            سيتم نقل <span className="font-semibold">{requestCount}</span> طلب صيانة تخصّ{" "}
            <span className="font-semibold">{groupLabel}</span> إلى المحذوفات، ضمن الفترة
            المعروضة حاليًا فقط. يمكن استعادة أي طلب لاحقًا من صفحة المحذوفات.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-1"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            نعم، احذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
