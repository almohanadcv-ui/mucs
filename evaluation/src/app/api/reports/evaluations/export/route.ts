import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { withAuth } from "@/lib/api-handler";
import { Permission } from "@/core/domain/permissions";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AuditAction } from "@/core/domain/enums";
import {
  getEvaluationReport,
  REPORT_COLUMNS,
  type EvaluationReportRow,
} from "@/core/application/reports/report-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toCsv(rows: EvaluationReportRow[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = REPORT_COLUMNS.map((c) => c.header).join(",");
  const lines = rows.map((r) =>
    REPORT_COLUMNS.map((c) => escape(r[c.key])).join(","),
  );
  // BOM so Excel renders Arabic (UTF-8) correctly.
  return "﻿" + [header, ...lines].join("\r\n");
}

async function toXlsx(rows: EvaluationReportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("التقييمات", { views: [{ rightToLeft: true }] });
  ws.columns = REPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: 18,
  }));
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

    const rows = await getEvaluationReport(user, { status, from, to });

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
      const buf = await toXlsx(rows);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="evaluations-${stamp}.xlsx"`,
        },
      });
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evaluations-${stamp}.csv"`,
      },
    });
  },
  { permission: Permission.REPORT_EXPORT },
);
