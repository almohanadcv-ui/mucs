"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { SavedFiltersBar } from "@/components/saved-filters/saved-filters-bar";
import { usePermission } from "@/lib/auth/use-permission";
import { useLocale } from "@/lib/i18n/locale-context";
import { vehicleStatusLabel, vehicleStatusVariant } from "@/lib/vehicle-status";
import { listVehicles } from "@/features/vehicles/api";

export default function VehiclesPage() {
  const canCreate = usePermission("vehicles:create");
  const { locale } = useLocale();
  const t = useTranslations("vehicles");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", search],
    queryFn: () => listVehicles({ page: 1, pageSize: 20, search: search || undefined }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/vehicles/new">{t("add")}</Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <SavedFiltersBar
          module="vehicles"
          currentFilter={{ search }}
          onApply={(filter) => setSearch((filter.search as string) ?? "")}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colPlate")}</TableHead>
              <TableHead>{t("colVehicle")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colBranch")}</TableHead>
              <TableHead>{t("colDriver")}</TableHead>
              <TableHead>{t("colOdometer")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">
                  <Link href={`/vehicles/${vehicle.id}`} className="hover:underline">
                    {vehicle.plateNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{vehicle.name ?? `${vehicle.make} ${vehicle.model}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {vehicle.make} {vehicle.model} - {vehicle.year}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={vehicleStatusVariant(vehicle.status)}>
                    {vehicleStatusLabel(vehicle.status, locale)}
                  </Badge>
                </TableCell>
                <TableCell>{vehicle.branch?.name ?? "—"}</TableCell>
                <TableCell>
                  {vehicle.currentDriver
                    ? `${vehicle.currentDriver.firstName} ${vehicle.currentDriver.lastName}`
                    : "—"}
                </TableCell>
                <TableCell>{vehicle.odometer.toLocaleString()} km</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
