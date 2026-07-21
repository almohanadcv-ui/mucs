"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { formatSAR } from "@/lib/currency";
import { INVOICE_STATUS_LABELS, type InvoiceStatusValue } from "@mica-mab/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { useLocale } from "@/lib/i18n/locale-context";
import { UploadInvoiceDialog } from "@/features/invoices/upload-invoice-dialog";
import { RejectInvoiceDialog } from "@/features/invoices/reject-invoice-dialog";
import { InvoiceDeleteButton } from "@/features/invoices/invoice-delete-button";
import { acceptInvoice, listInvoices, openInvoiceFile, type InvoiceItem } from "@/features/invoices/api";

const STATUS_VARIANT: Record<InvoiceStatusValue, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  ACCEPTED: "default",
  REJECTED: "destructive",
};

export default function InvoicesPage() {
  const canCreate = usePermission("invoices:create");
  const canApprove = usePermission("invoices:approve");
  const canReject = usePermission("invoices:reject");
  const canDelete = usePermission("invoices:delete");
  const { locale } = useLocale();
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => listInvoices(statusFilter ? { status: statusFilter } : {}),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptInvoice(id, {}),
    onSuccess: () => {
      toast.success(t("acceptedToast"));
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("acceptFailed")
        : t("acceptFailed");
      toast.error(message);
    },
  });

  function statusLabel(status: string) {
    return INVOICE_STATUS_LABELS[status as InvoiceStatusValue]?.[locale] ?? status;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && <UploadInvoiceDialog />}
      </div>

      <div className="flex gap-2">
        {["", "PENDING", "ACCEPTED", "REJECTED"].map((s) => (
          <Button
            key={s || "ALL"}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {s === "" ? t("filterAll") : statusLabel(s)}
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colVehicle")}</TableHead>
              <TableHead>{t("colAmount")}</TableHead>
              <TableHead>{t("colWorkshop")}</TableHead>
              <TableHead>{t("colDate")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-end">{t("colActions")}</TableHead>
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

            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}

            {data?.map((invoice: InvoiceItem) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.vehicle?.plateNumber ?? "—"}
                </TableCell>
                <TableCell>{formatSAR(invoice.amount)}</TableCell>
                <TableCell>{invoice.workshopName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[invoice.status]}>{statusLabel(invoice.status)}</Badge>
                  {invoice.status === "REJECTED" && invoice.rejectionReason && (
                    <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                      {invoice.rejectionReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openInvoiceFile(invoice.id)}>
                      {tc("view")}
                    </Button>
                    {invoice.status === "PENDING" && canApprove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acceptMutation.isPending}
                        onClick={() => acceptMutation.mutate(invoice.id)}
                      >
                        {tc("accept")}
                      </Button>
                    )}
                    {invoice.status === "PENDING" && canReject && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setRejectTarget(invoice.id)}
                      >
                        {tc("reject")}
                      </Button>
                    )}
                    {canDelete && (
                      <InvoiceDeleteButton
                        invoiceId={invoice.id}
                        label={invoice.vehicle?.plateNumber ?? formatSAR(invoice.amount)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RejectInvoiceDialog
        invoiceId={rejectTarget}
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      />
    </div>
  );
}
