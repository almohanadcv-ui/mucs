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
import { deleteInvoice } from "./api";

/**
 * Deletes an invoice after an explicit confirmation. Soft delete on the server,
 * restorable from Trash — which is what makes this safe to expose beyond the
 * super admin, since an invoice is a financial record.
 *
 * Lives in the invoices list (there is no invoice detail page), so it stays on
 * the page after success and just refreshes the list.
 *
 * Gated by the caller via `invoices:delete`.
 */
export function InvoiceDeleteButton({
  invoiceId,
  label,
}: {
  invoiceId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteInvoice(invoiceId),
    onSuccess: () => {
      toast.success("تم نقل الفاتورة إلى المحذوفات");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر حذف الفاتورة")
        : "تعذّر حذف الفاتورة";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          aria-label="حذف الفاتورة"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف الفاتورة</DialogTitle>
          <DialogDescription>
            سيتم نقل فاتورة <span className="font-semibold">{label}</span> إلى المحذوفات.
            يمكن استعادتها لاحقًا من صفحة المحذوفات.
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
