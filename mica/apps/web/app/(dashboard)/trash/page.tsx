"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listDeletedInvoices,
  listDeletedMaintenance,
  listDeletedVehicles,
  restoreInvoice,
  restoreMaintenanceRequest,
  restoreVehicle,
} from "@/features/trash/api";

export default function TrashPage() {
  const t = useTranslations("trash");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <DeletedVehiclesCard />
      <DeletedMaintenanceCard />
      <DeletedInvoicesCard />
    </div>
  );
}

function DeletedMaintenanceCard() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trash", "maintenance"],
    queryFn: listDeletedMaintenance,
  });

  const mutation = useMutation({
    mutationFn: restoreMaintenanceRequest,
    onSuccess: () => {
      toast.success(t("maintenanceRestored"));
      queryClient.invalidateQueries({ queryKey: ["trash", "maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: () => toast.error(t("maintenanceRestoreFailed")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("deletedMaintenance")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">{t("colRequest")}</TableHead>
              <TableHead>{t("colVehicle")}</TableHead>
              <TableHead>{t("colDeleted")}</TableHead>
              <TableHead className="text-end pe-6">{t("colAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="px-6">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t("noMaintenance")}
                </TableCell>
              </TableRow>
            )}
            {data?.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="ps-6 font-medium">{req.requestNumber}</TableCell>
                <TableCell>{req.vehicle?.plateNumber ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {req.deletedAt ? new Date(req.deletedAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="pe-6 text-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(req.id)}
                  >
                    {tc("restore")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DeletedVehiclesCard() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trash", "vehicles"],
    queryFn: listDeletedVehicles,
  });

  const mutation = useMutation({
    mutationFn: restoreVehicle,
    onSuccess: () => {
      toast.success(t("vehicleRestored"));
      queryClient.invalidateQueries({ queryKey: ["trash", "vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: () => toast.error(t("vehicleRestoreFailed")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("deletedVehicles")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">{t("colPlate")}</TableHead>
              <TableHead>{t("colVehicle")}</TableHead>
              <TableHead>{t("colDeleted")}</TableHead>
              <TableHead className="text-end pe-6">{t("colAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="px-6">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t("noVehicles")}
                </TableCell>
              </TableRow>
            )}
            {data?.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="ps-6 font-medium">{v.plateNumber}</TableCell>
                <TableCell>
                  {v.year} {v.make} {v.model}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.deletedAt ? new Date(v.deletedAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="pe-6 text-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(v.id)}
                  >
                    {tc("restore")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DeletedInvoicesCard() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trash", "invoices"],
    queryFn: listDeletedInvoices,
  });

  const mutation = useMutation({
    mutationFn: restoreInvoice,
    onSuccess: () => {
      toast.success(t("invoiceRestored"));
      queryClient.invalidateQueries({ queryKey: ["trash", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => toast.error(t("invoiceRestoreFailed")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("deletedInvoices")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">{t("colVehicle")}</TableHead>
              <TableHead>{t("colAmount")}</TableHead>
              <TableHead>{t("colDeleted")}</TableHead>
              <TableHead className="text-end pe-6">{t("colAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="px-6">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t("noInvoices")}
                </TableCell>
              </TableRow>
            )}
            {data?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="ps-6 font-medium">
                  {inv.vehicle?.plateNumber ?? "—"}
                </TableCell>
                <TableCell>{Number(inv.amount).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.deletedAt ? new Date(inv.deletedAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="pe-6 text-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(inv.id)}
                  >
                    {tc("restore")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
