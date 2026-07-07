"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Car, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyVehicles } from "@/features/driver-portal/api";

export default function MyVehiclesPage() {
  const t = useTranslations("driverPortal.vehicles");
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["driver-portal", "vehicles"],
    queryFn: listMyVehicles,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isLoading && vehicles?.length === 0 && (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles?.map((vehicle) => {
          const cancelled = vehicle.status === "CANCELLED";
          return (
            <Card key={vehicle.id} className={cancelled ? "opacity-60" : undefined}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    cancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  }`}
                >
                  {cancelled ? <Ban className="size-5" /> : <Car className="size-5" />}
                </span>
                <CardTitle className="flex items-center gap-2 text-base">
                  {vehicle.plateNumber}
                  {cancelled && <Badge variant="secondary">ملغية</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {vehicle.name ?? `${vehicle.make} ${vehicle.model}`}
                  {vehicle.year ? ` · ${vehicle.year}` : ""}
                </p>
                {cancelled ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    هذه المركبة ملغية ولم تعد متاحة.
                  </p>
                ) : (
                  <Link
                    href={`/driver/reports/new?vehicleId=${vehicle.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("reportIssue")}
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
