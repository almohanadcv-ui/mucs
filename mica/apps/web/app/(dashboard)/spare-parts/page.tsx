"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { useTranslations } from "next-intl";
import { usePermission } from "@/lib/auth/use-permission";
import { formatSAR } from "@/lib/currency";
import { CreateSparePartDialog } from "@/features/spare-parts/create-spare-part-dialog";
import { listSpareParts, deleteSparePart } from "@/features/spare-parts/api";

export default function SparePartsPage() {
  const canCreate = usePermission("spare-parts:create");
  const canDelete = usePermission("spare-parts:delete");
  const t = useTranslations("spareParts");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["spare-parts"], queryFn: () => listSpareParts() });

  const del = useMutation({
    mutationFn: deleteSparePart,
    onSuccess: () => {
      toast.success("تم حذف القطعة");
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
    },
    onError: () => toast.error("تعذّر الحذف"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && <CreateSparePartDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colSku")}</TableHead>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colUnitCost")}</TableHead>
              <TableHead>{t("colOnHand")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              {canDelete && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}

            {data?.map((part) => (
              <TableRow key={part.id}>
                <TableCell className="font-medium">{part.sku}</TableCell>
                <TableCell>{part.name}</TableCell>
                <TableCell>{formatSAR(part.unitCost)}</TableCell>
                <TableCell>{part.quantityOnHand}</TableCell>
                <TableCell>
                  {part.quantityOnHand <= part.reorderThreshold ? (
                    <Badge variant="destructive">{t("reorder")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("ok")}</Badge>
                  )}
                </TableCell>
                {canDelete && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm(`حذف القطعة «${part.name}»؟`)) del.mutate(part.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
