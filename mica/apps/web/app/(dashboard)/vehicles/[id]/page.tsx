"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/lib/auth/use-permission";
import { useLocale } from "@/lib/i18n/locale-context";
import { vehicleStatusLabel, vehicleStatusVariant } from "@/lib/vehicle-status";
import { getVehicle } from "@/features/vehicles/api";
import { VehicleStatusSelect } from "@/features/vehicles/vehicle-status-select";
import { VehicleFuelSelect } from "@/features/vehicles/vehicle-fuel-select";
import { VehicleDriverSelect } from "@/features/vehicles/vehicle-driver-select";
import { RequestPhotosButton } from "@/features/photo-requests/request-photos-button";
import { BookAppointmentButton } from "@/features/appointments/book-appointment-button";
import { VehiclePhotoRequests } from "@/features/photo-requests/vehicle-photo-requests";
import { VehicleEditDialog } from "@/features/vehicles/vehicle-edit-dialog";
import { VehicleDeleteButton } from "@/features/vehicles/vehicle-delete-button";
import { VehicleTimeline } from "@/features/vehicles/vehicle-timeline";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileBarChart } from "lucide-react";
import { MediaGallery } from "@/components/media/media-gallery";
import { VehicleGallery } from "@/features/vehicles/vehicle-gallery";
import { VehicleReports } from "@/features/vehicles/vehicle-reports";

function formatDate(value: string | null): string | undefined {
  return value ? new Date(value).toLocaleDateString() : undefined;
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const t = useTranslations("vehicles");
  const canUpload = usePermission("media:create");
  const canDeleteMedia = usePermission("media:delete");
  const canUpdate = usePermission("vehicles:update");
  const canDelete = usePermission("vehicles:delete");

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => getVehicle(id),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!vehicle) return <p className="text-muted-foreground">{t("notFound")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{vehicle.plateNumber}</h1>
            {canUpdate ? (
              <VehicleStatusSelect vehicleId={vehicle.id} status={vehicle.status} />
            ) : (
              <Badge variant={vehicleStatusVariant(vehicle.status)}>
                {vehicleStatusLabel(vehicle.status, locale)}
              </Badge>
            )}
          </div>
          {canUpdate && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <VehicleFuelSelect
                vehicleId={vehicle.id}
                fuelLevel={vehicle.fuelLevel}
                fuelUpdatedByName={vehicle.fuelUpdatedByName}
                fuelUpdatedAt={vehicle.fuelUpdatedAt}
              />
              <VehicleDriverSelect
                vehicleId={vehicle.id}
                currentDriverId={vehicle.currentDriverId}
              />
              <VehicleEditDialog vehicle={vehicle} />
              <Button asChild variant="outline" size="sm" className="h-8 gap-1">
                <Link href={`/vehicles/${vehicle.id}/report`}>
                  <FileBarChart className="size-4" /> تقرير المركبة
                </Link>
              </Button>
              <RequestPhotosButton vehicleId={vehicle.id} />
              <BookAppointmentButton vehicleId={vehicle.id} />
              {canDelete && (
                <VehicleDeleteButton vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} />
              )}
            </div>
          )}
          {/* Management holds vehicles:delete without vehicles:update, so the
              update-gated actions row above is hidden for them — surface delete
              on its own here. */}
          {!canUpdate && canDelete && (
            <div className="mt-2">
              <VehicleDeleteButton vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} />
            </div>
          )}
          <p className="text-muted-foreground">
            {vehicle.name ? `${vehicle.name} · ` : ""}
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-md border p-2">
          <QRCodeSVG value={vehicle.qrCodeValue} size={72} />
          <p className="text-[10px] text-muted-foreground">{t("scanToLookup")}</p>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t("tabInfo")}</TabsTrigger>
          <TabsTrigger value="gallery">معرض الصور</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
          <TabsTrigger value="photo-requests">طلبات التصوير</TabsTrigger>
          <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
          <TabsTrigger value="media">{t("tabMedia")}</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>السجل الزمني للمركبة</CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleTimeline vehicleId={vehicle.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery">
          <VehicleGallery vehicleId={vehicle.id} canManage={canUpload} />
        </TabsContent>

        <TabsContent value="photo-requests">
          <Card>
            <CardHeader>
              <CardTitle>طلبات التصوير وردود السائق</CardTitle>
            </CardHeader>
            <CardContent>
              <VehiclePhotoRequests vehicleId={vehicle.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <VehicleReports vehicleId={vehicle.id} canManage={canUpload} />
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>{t("information")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <Field label={t("vin")} value={vehicle.vin} />
              <Field label={t("color")} value={vehicle.color ?? undefined} />
              <Field label={t("odometer")} value={`${vehicle.odometer.toLocaleString()} km`} />
              <Field
                label={t("oilMeter")}
                value={vehicle.oilMeter != null ? `${vehicle.oilMeter.toLocaleString()} km` : undefined}
              />
              <Field label="تاريخ آخر تغيير زيت" value={formatDate(vehicle.lastOilChangeAt)} />
              <Field
                label="العداد عند تغيير الزيت"
                value={
                  vehicle.oilChangeOdometer != null
                    ? `${vehicle.oilChangeOdometer.toLocaleString()} km`
                    : undefined
                }
              />
              <Field label={t("oilChangeDue")} value={formatDate(vehicle.oilChangeDueAt)} />
              <Field label={t("nextMaintenance")} value={formatDate(vehicle.nextMaintenanceAt)} />
              <Field label="موعد الفحص/التشييك القادم" value={formatDate(vehicle.nextInspectionAt)} />
              <Field label={t("receiver")} value={vehicle.receiverName ?? undefined} />
              <Field label={t("party")} value={vehicle.party ?? undefined} />
              <Field
                label={t("currentDriver")}
                value={
                  vehicle.currentDriver
                    ? `${vehicle.currentDriver.firstName} ${vehicle.currentDriver.lastName}`
                    : undefined
                }
              />
              <Field label={t("added")} value={new Date(vehicle.createdAt).toLocaleDateString()} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabMedia")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaGallery
                entityType="VEHICLE"
                entityId={vehicle.id}
                canUpload={canUpload}
                canDelete={canDeleteMedia}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p>{value ?? "—"}</p>
    </div>
  );
}
