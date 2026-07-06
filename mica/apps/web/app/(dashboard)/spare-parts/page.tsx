"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
import { CreateSparePartDialog } from "@/features/spare-parts/create-spare-part-dialog";
import { listSpareParts } from "@/features/spare-parts/api";

export default function SparePartsPage() {
  const canCreate = usePermission("spare-parts:create");
  const t = useTranslations("spareParts");

  const { data, isLoading } = useQuery({ queryKey: ["spare-parts"], queryFn: () => listSpareParts() });

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
                <TableCell>{part.unitCost}</TableCell>
                <TableCell>{part.quantityOnHand}</TableCell>
                <TableCell>
                  {part.quantityOnHand <= part.reorderThreshold ? (
                    <Badge variant="destructive">{t("reorder")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("ok")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
