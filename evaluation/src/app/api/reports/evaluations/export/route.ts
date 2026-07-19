import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { withAuth } from "@/lib/api-handler";
import { Permission } from "@/core/domain/permissions";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AuditAction } from "@/core/domain/enums";
import {
  getEvaluationReport,
  reportColumns,
  type EvaluationReportRow,
} from "@/core/application/reports/report-service";
import { getT, getLocale } from "@/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Column = { key: keyof EvaluationReportRow; header: string };

function toCsv(rows: EvaluationReportRow[], columns: Column[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.header).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(r[c.key])).join(","));
  // BOM so Excel renders UTF-8 (Arabic) correctly.
  return "﻿" + [header, ...lines].join("\r\n");
}

async function toXlsx(
  rows: EvaluationReportRow[],
  columns: Column[],
  sheetName: string,
  rtl: boolean,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: rtl }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 18 }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export const GET = withAuth(
  async ({ user, meta, req }) => {
    const sp = req.nextUrl.searchParams;
    const format = (sp.get("format") ?? "csv").toLowerCase();
    const status = sp.get("status") ?? undefined;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;

    const t = await getT();
    const locale = await getLocale();
    const rows = await getEvaluationReport(user, { status, from, to }, t);
    const columns = reportColumns(t);

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.EXPORT,
      entity: "Evaluation",
      after: { format, count: rows.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "xlsx") {
      const buf = await toXlsx(rows, columns, t("reports.sheetName"), locale === "ar");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="evaluations-${stamp}.xlsx"`,
        },
      });
    }

    return new NextResponse(toCsv(rows, columns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evaluations-${stamp}.csv"`,
      },
    });
  },
  { permission: Permission.REPORT_EXPORT },
);
