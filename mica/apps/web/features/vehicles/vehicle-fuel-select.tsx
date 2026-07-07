"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Fuel } from "lucide-react";
import { FUEL_LEVELS, FUEL_LEVEL_LABELS, type FuelLevelValue } from "@mica-mab/shared-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";
import { updateVehicle } from "./api";

/**
 * Quick fuel-level picker. Changing it stamps who/when on the server, and we
 * surface the last update below so everyone sees the latest reading + author.
 */
export function VehicleFuelSelect({
  vehicleId,
  fuelLevel,
  fuelUpdatedByName,
  fuelUpdatedAt,
}: {
  vehicleId: string;
  fuelLevel: string | null;
  fuelUpdatedByName: string | null;
  fuelUpdatedAt: string | null;
}) {
  const { locale } = useLocale();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (next: string) => updateVehicle(vehicleId, { fuelLevel: next as never }),
    onSuccess: () => {
      toast.success(locale === "ar" ? "تم تحديث مستوى الوقود" : "Fuel level updated");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error) => {
      const fallback = locale === "ar" ? "تعذّر تحديث الوقود" : "Failed to update fuel";
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? fallback)
        : fallback;
      toast.error(message);
    },
  });

  const label = (v: FuelLevelValue) => FUEL_LEVEL_LABELS[v][locale === "ar" ? "ar" : "en"];

  return (
    <div className="space-y-1">
      <Select
        value={fuelLevel ?? undefined}
        onValueChange={(v) => mutation.mutate(v)}
        disabled={mutation.isPending}
      >
        <SelectTrigger className="h-8 w-48">
          <Fuel className="size-4 text-muted-foreground" />
          <SelectValue placeholder={locale === "ar" ? "مستوى الوقود" : "Fuel level"} />
        </SelectTrigger>
        <SelectContent>
          {FUEL_LEVELS.map((f) => (
            <SelectItem key={f} value={f}>
              {label(f)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fuelUpdatedAt && (
        <p className="text-xs text-muted-foreground">
          {locale === "ar" ? "آخر تحديث:" : "Updated:"}{" "}
          {new Date(fuelUpdatedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
          {fuelUpdatedByName ? ` — ${fuelUpdatedByName}` : ""}
        </p>
      )}
    </div>
  );
}
