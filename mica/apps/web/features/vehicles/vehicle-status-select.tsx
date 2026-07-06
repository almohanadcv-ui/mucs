"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { VEHICLE_STATUSES } from "@mica-mab/shared-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";
import { vehicleStatusLabel } from "@/lib/vehicle-status";
import { updateVehicle } from "./api";

export function VehicleStatusSelect({ vehicleId, status }: { vehicleId: string; status: string }) {
  const { locale } = useLocale();
  const t = useTranslations("vehicles");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (next: string) => updateVehicle(vehicleId, { status: next as never }),
    onSuccess: () => {
      toast.success(t("statusUpdated"));
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("statusUpdateFailed")
        : t("statusUpdateFailed");
      toast.error(message);
    },
  });

  return (
    <Select value={status} onValueChange={(v) => mutation.mutate(v)} disabled={mutation.isPending}>
      <SelectTrigger className="h-8 w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VEHICLE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {vehicleStatusLabel(s, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
