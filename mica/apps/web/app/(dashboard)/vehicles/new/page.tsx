"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { createVehicleSchema, type CreateVehicleInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createVehicle } from "@/features/vehicles/api";

export default function NewVehiclePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("vehicles");
  const tc = useTranslations("common");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: { odometer: 0 },
  });

  const mutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: (vehicle) => {
      toast.success(t("createdToast"));
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      router.push(`/vehicles/${vehicle.id}`);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("createFailed")
        : t("createFailed");
      toast.error(message);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("addTitle")}</h1>
        <p className="text-muted-foreground">{t("addSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("cardVehicle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plateNumber">{t("plateNumber")} *</Label>
              <Input id="plateNumber" {...register("plateNumber")} />
              {errors.plateNumber && (
                <p className="text-sm text-destructive">{errors.plateNumber.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">{t("vin")} *</Label>
              <Input id="vin" {...register("vin")} />
              {errors.vin && <p className="text-sm text-destructive">{errors.vin.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="make">{t("makeType")} *</Label>
              <Input id="make" {...register("make")} />
              {errors.make && <p className="text-sm text-destructive">{errors.make.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">{t("model")} *</Label>
              <Input id="model" {...register("model")} />
              {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">{t("year")} *</Label>
              <Input id="year" type="number" {...register("year")} />
              {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">{t("color")}</Label>
              <Input id="color" {...register("color")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("cardMeters")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="odometer">{t("odometer")}</Label>
              <Input id="odometer" type="number" {...register("odometer")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oilMeter">{t("oilMeter")}</Label>
              <Input id="oilMeter" type="number" {...register("oilMeter")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oilChangeDueAt">{t("oilChangeDue")}</Label>
              <Input id="oilChangeDueAt" type="date" {...register("oilChangeDueAt")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextMaintenanceAt">{t("nextMaintenance")}</Label>
              <Input id="nextMaintenanceAt" type="date" {...register("nextMaintenanceAt")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("cardIntake")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="receiverName">{t("receiver")}</Label>
              <Input id="receiverName" {...register("receiverName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party">{t("party")}</Label>
              <Input id="party" {...register("party")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? t("adding") : t("add")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tc("cancel")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
