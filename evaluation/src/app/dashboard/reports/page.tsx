import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import {
  getEvaluationReport,
  REPORT_COLUMNS,
} from "@/core/application/reports/report-service";
import { Card, CardContent } from "@/components/ui/card";
import { ReportToolbar } from "@/features/reports/report-toolbar";

export const metadata: Metadata = { title: "التقارير" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.REPORT_VIEW)) redirect("/dashboard");

  const rows = await getEvaluationReport(user, {});
  const approved = rows.filter((r) => r.status === "معتمد");
  const avg =
    approved.length > 0
      ? Math.round(
          (approved.reduce((s, r) => s + (r.score ?? 0), 0) / approved.length) * 10,
        ) / 10
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="size-6 text-primary" /> تقرير التقييمات
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} تقييم · {approved.length} معتمد · متوسط {avg}
          </p>
        </div>
        <ReportToolbar />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  {REPORT_COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={REPORT_COLUMNS.length} className="py-12 text-center text-muted-foreground">
                      لا توجد بيانات.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {REPORT_COLUMNS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-3 py-2.5">
                          {r[c.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
