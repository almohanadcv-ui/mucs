"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAppointmentDialog } from "./create-appointment-dialog";

/** Book an appointment for a specific vehicle. The vehicle's current driver is
 *  notified in real time when the appointment is created. */
export function BookAppointmentButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" /> حجز موعد للسيارة
      </Button>
      <CreateAppointmentDialog open={open} onOpenChange={setOpen} initialVehicleId={vehicleId} />
    </>
  );
}
