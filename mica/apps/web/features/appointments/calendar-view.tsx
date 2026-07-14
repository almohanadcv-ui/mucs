"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import withDragAndDrop, { type withDragAndDropProps } from "react-big-calendar/lib/addons/dragAndDrop";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { usePermission } from "@/lib/auth/use-permission";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listAppointments,
  updateAppointment,
  deleteAppointment,
  type AppointmentItem,
} from "./api";
import { CreateAppointmentDialog } from "./create-appointment-dialog";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales: { "en-US": enUS },
});

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as never);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: AppointmentItem;
}

const TYPE_COLOR: Record<string, string> = {
  MAINTENANCE: "#ef4444",
  INSPECTION: "#f59e0b",
  DELIVERY: "#3b82f6",
  OTHER: "#6b7280",
};

/**
 * Colour appointments by urgency, not type:
 *  🟢 done · 🔴 overdue · 🟠 due within 7 days · 🔵 scheduled (future).
 */
const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "مجدول",
  CONFIRMED: "مؤكد",
  COMPLETED: "منجز",
  CANCELLED: "ملغى",
  NO_SHOW: "لم يحضر",
};

function urgencyColor(appt: AppointmentItem): string {
  if (appt.status === "COMPLETED") return "#22c55e";
  if (appt.status === "CANCELLED" || appt.status === "NO_SHOW") return "#6b7280";
  const start = new Date(appt.startAt).getTime();
  const now = Date.now();
  if (start < now) return "#ef4444"; // overdue
  if (start - now <= 7 * 24 * 60 * 60 * 1000) return "#f59e0b"; // approaching
  return "#3b82f6"; // scheduled
}

function computeRange(date: Date, view: View): { start: Date; end: Date } {
  switch (view) {
    case "month":
      return {
        start: startOfWeek(startOfMonth(date), { locale: enUS }),
        end: endOfWeek(endOfMonth(date), { locale: enUS }),
      };
    case "week":
      return { start: startOfWeek(date, { locale: enUS }), end: endOfWeek(date, { locale: enUS }) };
    case "day":
      return { start: startOfDay(date), end: endOfDay(date) };
    default:
      return { start: startOfDay(date), end: addDays(date, 30) };
  }
}

export function CalendarView() {
  const queryClient = useQueryClient();
  const t = useTranslations("appointments");
  const canCreate = usePermission("appointments:create");
  const canReschedule = usePermission("appointments:reschedule");

  const canDelete = usePermission("appointments:delete");
  const canUpdate = usePermission("appointments:update");
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slot, setSlot] = useState<{ start: Date; end: Date } | undefined>();
  const [selected, setSelected] = useState<AppointmentItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      toast.success("تم حذف الموعد");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelected(null);
    },
    onError: () => toast.error("تعذّر حذف الموعد"),
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => updateAppointment(id, { status: "COMPLETED" }),
    onSuccess: () => {
      toast.success("تم تعليم الموعد كمنجز");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelected(null);
    },
    onError: () => toast.error("تعذّر التحديث"),
  });

  const range = useMemo(() => computeRange(date, view), [date, view]);

  const { data: appointments } = useQuery({
    queryKey: ["appointments", range.start.toISOString(), range.end.toISOString()],
    queryFn: () => listAppointments(range.start.toISOString(), range.end.toISOString()),
  });

  const events: CalendarEvent[] = useMemo(
    () =>
      (appointments ?? []).map((appointment) => ({
        id: appointment.id,
        title: appointment.title,
        start: new Date(appointment.startAt),
        end: new Date(appointment.endAt),
        resource: appointment,
      })),
    [appointments],
  );

  const selectedDayEvents = useMemo(
    () => events.filter((event) => isSameDay(event.start, date)),
    [date, events],
  );

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, start, end }: { id: string; start: Date; end: Date }) =>
      updateAppointment(id, { startAt: start.toISOString(), endAt: end.toISOString() }),
    onSuccess: (result) => {
      if (result.conflicts.length > 0) {
        toast.warning(t("rescheduledWithConflicts", { count: result.conflicts.length }));
      } else {
        toast.success(t("rescheduledToast"));
      }
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("rescheduleFailed")
        : t("rescheduleFailed");
      toast.error(message);
    },
  });

  const handleEventDrop: withDragAndDropProps<CalendarEvent>["onEventDrop"] = ({ event, start, end }) => {
    if (!canReschedule) {
      toast.error(t("noReschedulePermission"));
      return;
    }
    rescheduleMutation.mutate({ id: event.id, start: start as Date, end: end as Date });
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Focus the clicked day so the "day appointments" panel shows its events…
    setDate(slotInfo.start);
    // …and (with permission) offer to create a new appointment on that slot.
    if (!canCreate) return;
    setSlot({ start: slotInfo.start, end: slotInfo.end });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4 rounded-md border bg-card p-4">
      <div className="rounded-md border bg-muted/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("todayTasks")}</h2>
          <span className="text-xs text-muted-foreground">{format(date, "PP")}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {selectedDayEvents.map((event) => {
            const a = event.resource;
            return (
              <div key={event.id} className="rounded-md border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(event.start, "p")} - {format(event.end, "p")}
                    </p>
                  </div>
                  <span
                    className="rounded-sm px-2 py-1 text-[10px] font-medium text-white"
                    style={{ backgroundColor: urgencyColor(a) }}
                  >
                    {t(`types.${a.type}`)}
                  </span>
                </div>
                <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {a.vehicle && (
                    <div>
                      <span className="text-foreground/70">المركبة: </span>
                      {a.vehicle.name ?? `${a.vehicle.make} ${a.vehicle.model}`}
                      <span className="mx-1">·</span>
                      <span dir="ltr">{a.vehicle.plateNumber}</span>
                    </div>
                  )}
                  {a.assignedTo && (
                    <div>
                      <span className="text-foreground/70">الفني: </span>
                      {a.assignedTo.firstName} {a.assignedTo.lastName}
                    </div>
                  )}
                  <div>
                    <span className="text-foreground/70">الحالة: </span>
                    {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                  </div>
                </dl>
              </div>
            );
          })}
          {selectedDayEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noTasksForDay")}</p>
          )}
        </div>
      </div>
      <DnDCalendar
        localizer={localizer}
        events={events}
        date={date}
        view={view}
        onNavigate={setDate}
        onView={setView}
        selectable={canCreate}
        resizable={canReschedule}
        onSelectEvent={(event) => setSelected(event.resource)}
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventDrop}
        style={{ height: 700 }}
        eventPropGetter={(event) => ({
          style: { backgroundColor: urgencyColor(event.resource) },
        })}
      />

      <CreateAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStart={slot?.start}
        initialEnd={slot?.end}
      />

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>النوع: {t(`types.${selected.type}`)}</p>
              <p>
                الوقت: {format(new Date(selected.startAt), "PPp")} —{" "}
                {format(new Date(selected.endAt), "p")}
              </p>
              {selected.vehicle && (
                <p>
                  المركبة: {selected.vehicle.name ?? `${selected.vehicle.make} ${selected.vehicle.model}`}{" "}
                  · <span dir="ltr">{selected.vehicle.plateNumber}</span>
                </p>
              )}
              {selected.assignedTo && (
                <p>
                  الفني: {selected.assignedTo.firstName} {selected.assignedTo.lastName}
                </p>
              )}
              <p>الحالة: {APPOINTMENT_STATUS_LABEL[selected.status] ?? selected.status}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            {canUpdate && selected?.status !== "COMPLETED" && (
              <Button
                variant="outline"
                onClick={() => selected && completeMutation.mutate(selected.id)}
                disabled={completeMutation.isPending}
              >
                تعليم كمنجز
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (selected && confirm("حذف هذا الموعد؟")) deleteMutation.mutate(selected.id);
                }}
                disabled={deleteMutation.isPending}
              >
                حذف الموعد
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
