"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { deleteMaintenanceRequest } from "./api";

/**
 * Deletes a maintenance request after an explicit confirmation. Soft delete on
 * the server, so the copy promises Trash rather than permanent loss.
 *
 * The server also refuses deletion of an approved/in-progress request for the
 * Mechanic (Technical Support and Management may delete in any state). That
 * rejection arrives as a message we surface verbatim, rather than second-
 * guessing the rule here and hiding a button the API would have honoured.
 *
 * Gated by the caller via `maintenance:delete`.
 */
export function MaintenanceDeleteButton({
  requestId,
  requestNumber,
}: {
  requestId: string;
  requestNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteMaintenanceRequest(requestId),
    onSuccess: () => {
      toast.success("تم نقل طلب الصيانة إلى المحذوفات");
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setOpen(false);
      router.push("/maintenance");
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر حذف الطلب")
        : "تعذّر حذف الطلب";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" /> حذف الطلب
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف طلب الصيانة</DialogTitle>
          <DialogDescription>
            سيتم نقل الطلب <span className="font-semibold">{requestNumber}</span> إلى
            المحذوفات. يمكن استعادته لاحقًا من صفحة المحذوفات.
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
