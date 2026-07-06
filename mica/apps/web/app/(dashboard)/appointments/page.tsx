"use client";

import { CalendarView } from "@/features/appointments/calendar-view";
import { useTranslations } from "next-intl";

export default function AppointmentsPage() {
  const t = useTranslations("appointments");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>
      <CalendarView />
    </div>
  );
}
