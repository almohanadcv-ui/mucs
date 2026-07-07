"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { UserRound } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDrivers } from "@/features/drivers/api";
import { updateVehicle } from "./api";

const NONE = "__none__";

/**
 * Hand a vehicle over to a driver after creation. Only drivers linked to a user
 * account are offered — those are the ones who can receive photo requests and
 * see the vehicle in their driver portal.
 */
export function VehicleDriverSelect({
  vehicleId,
  currentDriverId,
}: {
  vehicleId: string;
  currentDriverId: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => listDrivers({ pageSize: 100 }),
  });
  const linkedDrivers = (drivers?.items ?? []).filter((d) => d.userId);

  const mutation = useMutation({
    mutationFn: (next: string | null) => updateVehicle(vehicleId, { currentDriverId: next }),
    onSuccess: () => {
      toast.success("تم تسليم السيارة للسائق");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error) => {
      toast.error(
        isAxiosError(error)
          ? ((error.response?.data as { message?: string })?.message ?? "تعذّر تسليم السيارة")
          : "تعذّر تسليم السيارة",
      );
    },
  });

  return (
    <div className="space-y-1">
      <Select
        value={currentDriverId ?? NONE}
        onValueChange={(v) => mutation.mutate(v === NONE ? null : v)}
        disabled={mutation.isPending}
      >
        <SelectTrigger className="h-8 w-56">
          <UserRound className="size-4 text-muted-foreground" />
          <SelectValue placeholder="تسليم لسائق" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>بدون سائق</SelectItem>
          {linkedDrivers.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              لا يوجد سائق مرتبط بحساب مستخدم
            </div>
          )}
          {linkedDrivers.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.firstName} {d.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
