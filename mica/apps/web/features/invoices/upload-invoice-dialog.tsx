"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { createInvoiceSchema, type CreateInvoiceInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listVehicles } from "@/features/vehicles/api";
import { createInvoice } from "./api";

export function UploadInvoiceDialog({ vehicleId }: { vehicleId?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles", "picker"],
    queryFn: () => listVehicles({ page: 1, pageSize: 100 }),
    enabled: open && !vehicleId,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { vehicleId: vehicleId ?? "" },
  });

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      toast.success(t("submittedToast"));
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      setFile(null);
      reset({ vehicleId: vehicleId ?? "" });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("submitFailed")
        : t("submitFailed");
      toast.error(message);
    },
  });

  const onSubmit = (values: CreateInvoiceInput) => {
    if (!file) {
      toast.error(t("attachFile"));
      return;
    }
    mutation.mutate({ ...values, file });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("upload")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("uploadTitle")}</DialogTitle>
          <DialogDescription>{t("uploadDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!vehicleId && (
            <div className="space-y-2">
              <Label>{t("vehicle")}</Label>
              <Controller
                name="vehicleId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectVehicle")} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.items.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.plateNumber} {v.name ? `· ${v.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && (
                <p className="text-sm text-destructive">{t("selectVehicle")}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="file">{t("file")} *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount")} *</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">{t("invoiceDate")}</Label>
              <Input id="invoiceDate" type="date" {...register("invoiceDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshopName">{t("supplierName")}</Label>
            <Input id="workshopName" {...register("workshopName")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? tc("submitting") : t("upload")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
