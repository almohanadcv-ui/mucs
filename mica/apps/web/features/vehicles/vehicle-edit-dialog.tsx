"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Pencil } from "lucide-react";
import { FUEL_LEVELS, FUEL_LEVEL_LABELS } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateVehicle, type VehicleListItem } from "./api";

/** yyyy-MM-dd for <input type=date>, or "" */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

type FormValues = {
  odometer: number;
  oilMeter: number | "";
  fuelLevel: string;
  lastOilChangeAt: string;
  oilChangeOdometer: number | "";
  oilChangeDueAt: string;
  nextMaintenanceAt: string;
  nextInspectionAt: string;
  notes: string;
};

export function VehicleEditDialog({ vehicle }: { vehicle: VehicleListItem }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm<FormValues>({
    values: {
      odometer: vehicle.odometer ?? 0,
      oilMeter: vehicle.oilMeter ?? "",
      fuelLevel: vehicle.fuelLevel ?? "",
      lastOilChangeAt: toDateInput(vehicle.lastOilChangeAt),
      oilChangeOdometer: vehicle.oilChangeOdometer ?? "",
      oilChangeDueAt: toDateInput(vehicle.oilChangeDueAt),
      nextMaintenanceAt: toDateInput(vehicle.nextMaintenanceAt),
      nextInspectionAt: toDateInput(vehicle.nextInspectionAt),
      notes: vehicle.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateVehicle(vehicle.id, {
        odometer: Number(values.odometer),
        oilMeter: values.oilMeter === "" ? undefined : Number(values.oilMeter),
        fuelLevel: (values.fuelLevel || undefined) as never,
        lastOilChangeAt: values.lastOilChangeAt || undefined,
        oilChangeOdometer:
          values.oilChangeOdometer === "" ? undefined : Number(values.oilChangeOdometer),
        oilChangeDueAt: values.oilChangeDueAt || undefined,
        nextMaintenanceAt: values.nextMaintenanceAt || undefined,
        nextInspectionAt: values.nextInspectionAt || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("تم حفظ التعديلات في سجل المركبة");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        isAxiosError(error)
          ? ((error.response?.data as { message?: string })?.message ?? "تعذّر الحفظ")
          : "تعذّر الحفظ",
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Pencil className="size-4" /> تعديل البيانات
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المركبة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="odometer">قراءة العداد الحالية (كم)</Label>
              <Input id="odometer" type="number" {...register("odometer")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fuelLevel">مستوى الوقود</Label>
              <select
                id="fuelLevel"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                {...register("fuelLevel")}
              >
                <option value="">—</option>
                {FUEL_LEVELS.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LEVEL_LABELS[f].ar}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastOilChangeAt">تاريخ آخر تغيير زيت</Label>
              <Input id="lastOilChangeAt" type="date" {...register("lastOilChangeAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oilChangeOdometer">قراءة العداد عند تغيير الزيت</Label>
              <Input id="oilChangeOdometer" type="number" {...register("oilChangeOdometer")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oilChangeDueAt">موعد تغيير الزيت القادم</Label>
              <Input id="oilChangeDueAt" type="date" {...register("oilChangeDueAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oilMeter">عداد الزيت (كم)</Label>
              <Input id="oilMeter" type="number" {...register("oilMeter")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nextMaintenanceAt">موعد الصيانة القادم</Label>
              <Input id="nextMaintenanceAt" type="date" {...register("nextMaintenanceAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nextInspectionAt">موعد الفحص/التشييك القادم</Label>
              <Input id="nextInspectionAt" type="date" {...register("nextInspectionAt")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">ملاحظات إضافية</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
