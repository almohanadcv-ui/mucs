"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { rejectInvoiceSchema, type RejectInvoiceInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rejectInvoice } from "./api";

export function RejectInvoiceDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("invoices");
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RejectInvoiceInput>({ resolver: zodResolver(rejectInvoiceSchema) });

  const mutation = useMutation({
    mutationFn: (input: RejectInvoiceInput) => rejectInvoice(invoiceId!, input),
    onSuccess: () => {
      toast.success(t("rejectedToast"));
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("rejectFailed")
        : t("rejectFailed");
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rejectTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">{t("reason")} *</Label>
            <Textarea id="rejectionReason" rows={2} {...register("rejectionReason")} />
            {errors.rejectionReason && (
              <p className="text-sm text-destructive">{errors.rejectionReason.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t("notesOptional")}</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? t("rejecting") : t("rejectButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
