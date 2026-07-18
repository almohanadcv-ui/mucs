import { VEHICLE_STATUS_LABELS, type VehicleStatusValue } from "@mica-mab/shared-types";
import type { Locale } from "@/lib/i18n/locale-context";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Maps each workshop status to a badge colour that reads intuitively on the floor. */
const STATUS_VARIANT: Record<VehicleStatusValue, BadgeVariant> = {
  AWAITING_RECEPTION: "outline",
  RECEIVED: "secondary",
  UNDER_INSPECTION: "secondary",
  UNDER_MAINTENANCE: "secondary",
  AWAITING_PARTS: "destructive",
  READY: "default",
  DELIVERED: "outline",
  CANCELLED: "destructive",
};

export function vehicleStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT[status as VehicleStatusValue] ?? "secondary";
}

export function vehicleStatusLabel(status: string, locale: Locale): string {
  const entry = VEHICLE_STATUS_LABELS[status as VehicleStatusValue];
  if (!entry) return status.replace(/_/g, " ");
  return entry[locale];
}
