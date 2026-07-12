"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { createAppointmentSchema, APPOINTMENT_TYPES, type CreateAppointmentInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listVehicles } from "@/features/vehicles/api";
import { createAppointment } from "./api";

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStart?: Date;
  initialEnd?: Date;
  initialVehicleId?: string;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  initialStart,
  initialEnd,
  initialVehicleId,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("appointments");
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: () => listVehicles({ page: 1, pageSize: 100 }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: { type: "OTHER", allDay: false },
  });

  useEffect(() => {
    if (open && initialStart && initialEnd) {
      setValue("startAt", initialStart.toISOString());
      setValue("endAt", initialEnd.toISOString());
    }
    if (open && initialVehicleId) setValue("vehicleId", initialVehicleId);
  }, [open, initialStart, initialEnd, initialVehicleId, setValue]);

  const mutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: (result) => {
      if (result.conflicts.length > 0) {
        toast.warning(t("createdWithConflicts", { count: result.conflicts.length }));
      } else {
        toast.success(t("createdToast"));
      }
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("createFailed")
        : t("createFailed");
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newTitle")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) =>
            mutation.mutate({
              ...values,
              branchId: vehicles?.items.find((v) => v.id === values.vehicleId)?.branchId ?? "",
            }),
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">{t("titleField")}</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`types.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("vehicle")}</Label>
              <Controller
                name="vehicleId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.items.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber} - {vehicle.name ?? `${vehicle.make} ${vehicle.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAt">{t("start")}</Label>
              <Input
                id="startAt"
                type="datetime-local"
                defaultValue={initialStart ? toLocalInput(initialStart) : undefined}
                onChange={(e) => setValue("startAt", new Date(e.target.value).toISOString())}
              />
              {errors.startAt && (
                <p className="text-sm text-destructive">{errors.startAt.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">{t("end")}</Label>
              <Input
                id="endAt"
                type="datetime-local"
                defaultValue={initialEnd ? toLocalInput(initialEnd) : undefined}
                onChange={(e) => setValue("endAt", new Date(e.target.value).toISOString())}
              />
              {errors.endAt && <p className="text-sm text-destructive">{errors.endAt.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
