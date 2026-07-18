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
import { deleteVehicle } from "./api";

/**
 * Deletes a vehicle after an explicit confirmation. The deletion is a soft
 * delete on the server (the vehicle moves to Trash and can be restored), so the
 * copy says "move to trash" rather than implying permanent loss.
 *
 * Gated by the caller via the `vehicles:delete` permission — this component
 * renders nothing about permissions itself.
 */
export function VehicleDeleteButton({
  vehicleId,
  plateNumber,
}: {
  vehicleId: string;
  plateNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteVehicle(vehicleId),
    onSuccess: () => {
      toast.success("تم نقل المركبة إلى المحذوفات");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
      // The vehicle no longer exists in the active list; go back to it.
      router.push("/vehicles");
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر حذف المركبة")
        : "تعذّر حذف المركبة";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> حذف المركبة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف المركبة</DialogTitle>
          <DialogDescription>
            سيتم نقل المركبة <span className="font-semibold">{plateNumber}</span> إلى
            المحذوفات. يمكن استعادتها لاحقًا من صفحة المحذوفات.
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
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            نعم، احذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
