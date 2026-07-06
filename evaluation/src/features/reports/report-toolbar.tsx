"use client";

import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportToolbar() {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button asChild variant="outline" size="sm">
        <a href="/api/reports/evaluations/export?format=csv" download>
          <FileText className="size-4" /> CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href="/api/reports/evaluations/export?format=xlsx" download>
          <FileSpreadsheet className="size-4" /> Excel
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> طباعة / PDF
      </Button>
    </div>
  );
}
