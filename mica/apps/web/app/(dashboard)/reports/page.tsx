"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/lib/auth/use-permission";
import { formatSAR } from "@/lib/currency";
import {
  downloadMaintenanceCostReport,
  getMaintenanceCostReport,
  type MaintenanceCostQuery,
} from "@/features/reports/api";
import { ReportRowDeleteButton } from "@/features/reports/report-row-delete-button";

export default function ReportsPage() {
  const canExport = usePermission("reports:export");
  const canDelete = usePermission("maintenance:delete");
  const [groupBy, setGroupBy] = useState<MaintenanceCostQuery["groupBy"]>("vehicle");

  const { data } = useQuery({
    queryKey: ["reports", "maintenance-cost", groupBy],
    queryFn: () => getMaintenanceCostReport({ groupBy }),
  });

  const totals = (data ?? []).reduce(
    (acc, row) => ({
      requests: acc.requests + row.requestCount,
      estimated: acc.estimated + row.totalEstimatedCost,
      actual: acc.actual + row.totalActualCost,
    }),
    { requests: 0, estimated: 0, actual: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">التقارير</h1>
          <p className="text-muted-foreground">تكلفة الصيانة حسب المركبة أو الفرع.</p>
        </div>
        <div className="flex gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as MaintenanceCostQuery["groupBy"])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle">حسب المركبة</SelectItem>
              <SelectItem value="branch">حسب الفرع</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </Button>
          {canExport && (
            <>
              <Button
                variant="outline"
                onClick={() => downloadMaintenanceCostReport({ groupBy }, "csv")}
              >
                <Download className="size-4" /> CSV
              </Button>
              <Button onClick={() => downloadMaintenanceCostReport({ groupBy }, "excel")}>
                <Download className="size-4" /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تكلفة الصيانة {groupBy === "vehicle" ? "حسب المركبة" : "حسب الفرع"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupBy === "vehicle" ? "المركبة" : "الفرع"}</TableHead>
                <TableHead className="text-right">الطلبات</TableHead>
                <TableHead className="text-right">التكلفة التقديرية</TableHead>
                <TableHead className="text-right">التكلفة الفعلية</TableHead>
                {canDelete && <TableHead className="w-12 print:hidden" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((row) => (
                <TableRow key={row.groupId}>
                  <TableCell className="font-medium">{row.groupLabel}</TableCell>
                  <TableCell className="text-right">{row.requestCount}</TableCell>
                  <TableCell className="text-right">{formatSAR(row.totalEstimatedCost)}</TableCell>
                  <TableCell className="text-right">{formatSAR(row.totalActualCost)}</TableCell>
                  {canDelete && (
                    <TableCell className="print:hidden">
                      <ReportRowDeleteButton
                        query={{ groupBy }}
                        groupId={row.groupId}
                        groupLabel={row.groupLabel}
                        requestCount={row.requestCount}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!data?.length && (
                <TableRow>
                  <TableCell colSpan={canDelete ? 5 : 4} className="text-center text-muted-foreground">
                    لا توجد بيانات تكلفة صيانة لهذا التصنيف بعد.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>الإجمالي</TableCell>
                <TableCell className="text-right">{totals.requests}</TableCell>
                <TableCell className="text-right">{formatSAR(totals.estimated)}</TableCell>
                <TableCell className="text-right">{formatSAR(totals.actual)}</TableCell>
                {canDelete && <TableCell className="print:hidden" />}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
