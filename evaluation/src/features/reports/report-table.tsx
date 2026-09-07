"use client";

import { useRouter } from "next/navigation";
import { withBase } from "@/lib/base-path";
import type { EvaluationReportRow } from "@/core/application/reports/report-service";

/**
 * The evaluations report table. Each row is clickable and opens that
 * evaluation's detail page, where it can be read, downloaded as PDF, or printed.
 */
export function ReportTable({
  rows,
  columns,
  noData,
}: {
  rows: EvaluationReportRow[];
  columns: { key: keyof EvaluationReportRow; header: string }[];
  noData: string;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-right text-muted-foreground">
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                {noData}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(withBase(`/dashboard/evaluations/${r.id}`))}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                title="فتح التقييم"
              >
                {columns.map((c) => (
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
  );
}
