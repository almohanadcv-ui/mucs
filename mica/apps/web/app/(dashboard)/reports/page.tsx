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
import {
  downloadMaintenanceCostReport,
  getMaintenanceCostReport,
  type MaintenanceCostQuery,
} from "@/features/reports/api";

export default function ReportsPage() {
  const canExport = usePermission("reports:export");
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
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Maintenance cost by vehicle or branch.</p>
        </div>
        <div className="flex gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as MaintenanceCostQuery["groupBy"])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle">By vehicle</SelectItem>
              <SelectItem value="branch">By branch</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
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
          <CardTitle>Maintenance cost by {groupBy}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupBy === "vehicle" ? "Vehicle" : "Branch"}</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Estimated cost</TableHead>
                <TableHead className="text-right">Actual cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((row) => (
                <TableRow key={row.groupId}>
                  <TableCell className="font-medium">{row.groupLabel}</TableCell>
                  <TableCell className="text-right">{row.requestCount}</TableCell>
                  <TableCell className="text-right">
                    ${row.totalEstimatedCost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">${row.totalActualCost.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!data?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No maintenance cost data for this grouping yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.requests}</TableCell>
                <TableCell className="text-right">${totals.estimated.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totals.actual.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
