"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Car, FileText, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { useLocale } from "@/lib/i18n/locale-context";
import { vehicleStatusLabel, vehicleStatusVariant } from "@/lib/vehicle-status";
import { listVehicles } from "@/features/vehicles/api";
import { UploadInvoiceDialog } from "@/features/invoices/upload-invoice-dialog";

/** Tablet-first home for mechanics: a few very large tap targets and a big
 *  vehicle search — usable one-handed on an iPad inside the workshop. */
export default function WorkshopPage() {
  const canCreateVehicle = usePermission("vehicles:create");
  const canCreateInvoice = usePermission("invoices:create");
  const { locale } = useLocale();
  const t = useTranslations("workshop");
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["vehicles", "workshop", search],
    queryFn: () => listVehicles({ page: 1, pageSize: 24, search: search || undefined }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Big action tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {canCreateVehicle && (
          <Link
            href="/vehicles/new"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 bg-primary p-8 text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            <Plus className="size-10" />
            <span className="text-lg font-semibold">{t("addVehicle")}</span>
          </Link>
        )}
        {canCreateInvoice && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-8 shadow-sm transition-transform active:scale-95">
            <FileText className="size-10 text-primary" />
            <span className="text-lg font-semibold">{t("uploadInvoice")}</span>
            <UploadInvoiceDialog />
          </div>
        )}
        <Link
          href="/vehicles"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-8 shadow-sm transition-transform active:scale-95"
        >
          <Car className="size-10 text-primary" />
          <span className="text-lg font-semibold">{t("allVehicles")}</span>
        </Link>
      </div>

      {/* Big search */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-14 ps-12 text-lg"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(isLoading || isFetching) &&
            !data &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}

          {data?.items.length === 0 && (
            <p className="col-span-full py-8 text-center text-muted-foreground">{t("empty")}</p>
          )}

          {data?.items.map((v) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-accent active:scale-[0.98]"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{v.plateNumber}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {v.name ? `${v.name} · ` : ""}
                  {v.year} {v.make} {v.model}
                </p>
              </div>
              <Badge variant={vehicleStatusVariant(v.status)} className="shrink-0">
                {vehicleStatusLabel(v.status, locale)}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
