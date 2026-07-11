"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Calendar, Car, Droplet, FileText, DollarSign, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session-context";
import { useLocale } from "@/lib/i18n/locale-context";
import { vehicleStatusLabel } from "@/lib/vehicle-status";
import { getDashboardKpis, getMaintenanceAlerts } from "@/features/dashboard/api";
import { usePermission } from "@/lib/auth/use-permission";
import { formatSAR } from "@/lib/currency";

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#06b6d4", "#eab308"];

export default function DashboardPage() {
  const { user } = useSession();
  const t = useTranslations("dashboard");
  const { locale } = useLocale();
  const isManager = usePermission("invoices:approve");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => getDashboardKpis(),
  });
  const { data: alerts } = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: () => getMaintenanceAlerts(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcomeBack", { name: user?.firstName ?? "" })}
        </h1>
        <p className="text-muted-foreground">
          {user?.roles.join("، ")} · {t("fleetOverview")}
        </p>
      </div>

      {alerts && alerts.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-amber-500" /> تنبيهات الصيانة والفحص ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a) => (
              <Link
                key={a.id}
                href={`/vehicles/${a.id}`}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{a.plateNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.currentDriver
                      ? `${a.currentDriver.firstName} ${a.currentDriver.lastName}`
                      : `${a.make} ${a.model}`}
                    {" · "}
                    {new Date(a.earliestDueAt).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <Badge variant={a.urgency === "overdue" ? "destructive" : "secondary"}>
                  {a.urgency === "overdue" ? "متأخّر" : "قريب"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Car} label={t("totalVehicles")} value={data?.totalVehicles ?? 0} />
            <KpiCard
              icon={FileText}
              label={t("pendingInvoices")}
              value={data?.pendingInvoices ?? 0}
              highlight={(data?.pendingInvoices ?? 0) > 0}
            />
            <KpiCard
              icon={Calendar}
              label={t("upcomingAppointments")}
              value={data?.upcomingAppointments ?? 0}
            />
            <KpiCard
              icon={DollarSign}
              label={t("maintenanceCostThisMonth")}
              value={formatSAR(
                isManager ? data?.monthlyApprovedInvoiceCost : data?.monthlyMaintenanceCost,
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={FileText} label={t("acceptedInvoices")} value={data?.acceptedInvoices ?? 0} />
            <KpiCard icon={FileText} label={t("rejectedInvoices")} value={data?.rejectedInvoices ?? 0} />
            <KpiCard
              icon={Droplet}
              label={t("oilChangeDue")}
              value={data?.oilChangeDueSoon ?? 0}
              highlight={(data?.oilChangeDueSoon ?? 0) > 0}
            />
            <KpiCard
              icon={Wrench}
              label={t("maintenanceDue")}
              value={data?.maintenanceDueSoon ?? 0}
              highlight={(data?.maintenanceDueSoon ?? 0) > 0}
            />
          </div>

          {(data?.overdueVehicleDocs ?? 0) + (data?.overdueDriverLicenses ?? 0) > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="size-5 shrink-0 text-destructive" />
                <p className="text-sm">
                  {t("overdueAlert", {
                    vehicles: data?.overdueVehicleDocs ?? 0,
                    drivers: data?.overdueDriverLicenses ?? 0,
                  })}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Car className="size-4" /> {t("vehiclesByStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.vehiclesByStatus ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="status"
                      fontSize={11}
                      tickFormatter={(s: string) => vehicleStatusLabel(s, locale)}
                    />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip formatter={(v) => [v, ""]} labelFormatter={(s: string) => vehicleStatusLabel(s, locale)} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(data?.vehiclesByStatus ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="size-4" /> {t("maintenanceByStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data?.maintenanceByStatus ?? []}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {(data?.maintenanceByStatus ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {(data?.maintenanceByStatus ?? []).map((entry, i) => (
                    <span key={entry.status} className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {entry.status.replace(/_/g, " ")} ({entry.count})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/50 bg-amber-500/5" : undefined}>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={
            highlight
              ? "flex size-10 items-center justify-center rounded-md bg-amber-500/15"
              : "flex size-10 items-center justify-center rounded-md bg-primary/10"
          }
        >
          <Icon className={highlight ? "size-5 text-amber-600" : "size-5 text-primary"} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
