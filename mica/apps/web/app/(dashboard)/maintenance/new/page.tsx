"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import {
  createMaintenanceRequestSchema,
  MAINTENANCE_PRIORITIES,
  type CreateMaintenanceRequestInput,
} from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listVehicles } from "@/features/vehicles/api";
import { createMaintenanceRequest } from "@/features/maintenance/api";

function toIsoFromLocal(value: string): string {
  return new Date(value).toISOString();
}

export default function NewMaintenanceRequestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("maintenance");
  const tc = useTranslations("common");
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: () => listVehicles({ page: 1, pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaintenanceRequestInput>({
    resolver: zodResolver(createMaintenanceRequestSchema),
    defaultValues: { priority: "MEDIUM", title: "Maintenance request" },
  });
  const selectedVehicleId = watch("vehicleId");

  const mutation = useMutation({
    mutationFn: createMaintenanceRequest,
    onSuccess: (request) => {
      toast.success(t("sentToast"));
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      router.push(`/maintenance/${request.id}`);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("sendFailed")
        : t("sendFailed");
      toast.error(message);
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("sendTitle")}</h1>
        <p className="text-muted-foreground">{t("sendSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("requestDetails")}</CardTitle>
        </CardHeader>
        <form
          onSubmit={handleSubmit((values) =>
            mutation.mutate({
              ...values,
              title: values.description.slice(0, 80) || "Maintenance request",
              branchId: vehicles?.items.find((v) => v.id === values.vehicleId)?.branchId ?? "",
            }),
          )}
        >
          <CardContent className="space-y-4">
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
                      {vehicles?.items.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber} - {vehicle.name ?? `${vehicle.make} ${vehicle.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && (
                <p className="text-sm text-destructive">{errors.vehicleId.message}</p>
              )}
            </div>

            <input type="hidden" {...register("title")} />

            {selectedVehicleId && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                {t("approvalHint")}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">{t("problem")}</Label>
              <Textarea id="description" rows={4} {...register("description")} />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("priority")}</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">{t("expectedPrice")}</Label>
                <Input id="estimatedCost" type="number" step="0.01" {...register("estimatedCost")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">{t("scheduledDate")}</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                {...register("scheduledDate", {
                  setValueAs: (value) => (value ? toIsoFromLocal(value) : undefined),
                })}
              />
              {errors.scheduledDate && (
                <p className="text-sm text-destructive">{errors.scheduledDate.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? tc("submitting") : t("sendToManager")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tc("cancel")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
