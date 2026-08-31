"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { UserRoundCog } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { UpdateVehicleInput } from "@mica-mab/shared-types";
import { listDrivers } from "@/features/drivers/api";
import { updateVehicle } from "./api";

const FUELS: { value: string; label: string }[] = [
  { value: "FULL", label: "ممتلئ" },
  { value: "THREE_QUARTERS", label: "ثلاثة أرباع" },
  { value: "HALF", label: "نصف" },
  { value: "QUARTER", label: "ربع" },
  { value: "EMPTY", label: "فارغ" },
];

/**
 * «تغيير السائق»: pick the new driver and fill the handover inspection
 * (odometer/fuel/notes). Saving closes the previous driver's report (kept under
 * their name on the server) and opens a new custody record for the new driver.
 */
export function ChangeDriverDialog({
  vehicleId,
  currentDriverId,
}: {
  vehicleId: string;
  currentDriverId: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [driverId, setDriverId] = useState<string>("");
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("");
  const [notes, setNotes] = useState("");

  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => listDrivers({ pageSize: 100 }),
    enabled: open,
  });
  const linked = (drivers?.items ?? []).filter((d) => d.userId && d.id !== currentDriverId);

  const mutation = useMutation({
    mutationFn: () =>
      updateVehicle(vehicleId, {
        currentDriverId: driverId,
        ...(odometer ? { odometer: Number(odometer) } : {}),
        ...(fuel ? { fuelLevel: fuel as UpdateVehicleInput["fuelLevel"] } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      } as UpdateVehicleInput),
    onSuccess: () => {
      toast.success("تم تغيير السائق وحفظ بيانات التسليم");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicles", vehicleId, "timeline"] });
      setOpen(false);
      setDriverId(""); setOdometer(""); setFuel(""); setNotes("");
    },
    onError: (e) =>
      toast.error(
        isAxiosError(e)
          ? ((e.response?.data as { message?: string })?.message ?? "تعذّر تغيير السائق")
          : "تعذّر تغيير السائق",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <UserRoundCog className="size-4" /> تغيير السائق
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تغيير السائق وتسليم المركبة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>السائق الجديد</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="اختر السائق" /></SelectTrigger>
              <SelectContent>
                {linked.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">لا يوجد سائق مرتبط بحساب</div>
                )}
                {linked.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>العداد (كم)</Label>
              <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="قراءة العداد" />
            </div>
            <div className="space-y-1">
              <Label>مستوى الوقود</Label>
              <Select value={fuel} onValueChange={setFuel}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {FUELS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>ملاحظات التسليم / حالة المركبة</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اكتب ملاحظات الفحص عند التسليم…" />
          </div>
          <p className="text-xs text-muted-foreground">
            سيُحفظ تقرير السائق السابق باسمه، ويُفتح تقرير جديد للسائق الجديد. (رفع الصور يُضاف قريبًا)
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!driverId || mutation.isPending}>
            {mutation.isPending ? "جارٍ…" : "تأكيد التغيير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
