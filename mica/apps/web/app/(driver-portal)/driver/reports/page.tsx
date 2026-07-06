"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyReports } from "@/features/driver-portal/api";

export default function MyReportsPage() {
  const t = useTranslations("driverPortal.reports");
  const tm = useTranslations("maintenance");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["driver-portal", "reports"],
    queryFn: listMyReports,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/driver/reports/new">{t("newReport")}</Link>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isLoading && reports?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}

      <div className="space-y-3">
        {reports?.map((report) => (
          <Link key={report.id} href={`/driver/reports/${report.id}`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
                <span className="font-medium">{report.requestNumber}</span>
                <Badge>{tm(`statuses.${report.status}`)}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 p-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  {report.vehicle?.plateNumber} — {report.vehicle?.make} {report.vehicle?.model}
                </p>
                <p className="line-clamp-2 text-sm">{report.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(report.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
