"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeStatusBadge } from "@/features/dashboard/status-badges";
import { useI18n } from "@/i18n/client";

interface ProfileEvaluation {
  id: string;
  score: number | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  template: { title: string } | null;
  evaluator: { name: string } | null;
}
interface Profile {
  employee: Record<string, unknown> & {
    id: string;
    name: string;
    employeeNo: string;
    status: string;
    department?: { name: string } | null;
    branch?: { name: string } | null;
    evaluator?: { name: string } | null;
  };
  evaluations: ProfileEvaluation[];
  stats: { count: number; scoredCount: number; average: number | null; last: number | null };
}

function Info({ label, value }: { label: string; value: unknown }) {
  const v = value == null || value === "" ? "—" : String(value);
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{v}</p>
    </div>
  );
}

function fmt(d: unknown, locale: string): string {
  if (!d) return "—";
  const date = new Date(d as string);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US");
}

export function EmployeeProfile({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-profile", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}/profile`);
      const b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(b?.error?.message ?? t("profile.fetchFailed"));
      return (b.data ?? b) as Profile;
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError || !data)
    return <p className="py-16 text-center text-destructive">{t("profile.loadFailed")}</p>;

  const { employee: e, evaluations, stats } = data;
  const chart = evaluations
    .filter((ev) => ev.score != null && ev.status !== "DRAFT")
    .slice()
    .reverse()
    .map((ev, i) => ({
      name: fmt(ev.submittedAt ?? ev.createdAt, locale),
      score: ev.score,
      idx: i + 1,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {e.name}
            <EmployeeStatusBadge status={e.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {e.employeeNo} · {e.department?.name ?? "—"} · {e.branch?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> {t("profile.print")}
          </Button>
          <Link
            href="/dashboard/employees"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-4" /> {t("common.back")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("profile.avgOverall")} value={stats.average != null ? `${stats.average}%` : "—"} accent />
        <StatCard label={t("profile.lastEval")} value={stats.last != null ? `${stats.last}%` : "—"} />
        <StatCard label={t("profile.evalCount")} value={stats.count} />
        <StatCard label={t("profile.scoredCount")} value={stats.scoredCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label={t("empForm.employeeNo")} value={e.employeeNo} />
          <Info label={t("empForm.nameEn")} value={e.nameEn} />
          <Info label={t("empForm.email")} value={e.email} />
          <Info label={t("empForm.nationalId")} value={e.nationalId} />
          <Info label={t("empForm.nationality")} value={e.nationality} />
          <Info label={t("empForm.gender")} value={e.gender} />
          <Info label={t("empForm.jobTitle")} value={e.jobTitle} />
          <Info label={t("empForm.directManager")} value={e.directManager} />
          <Info label={t("empForm.evaluator")} value={e.evaluator?.name} />
          <Info label={t("profile.birthDate")} value={fmt(e.birthDate, locale)} />
          <Info label={t("empForm.joinedAt")} value={fmt(e.joinedAt, locale)} />
          <Info label={t("profile.contractStartShort")} value={fmt(e.contractStartDate, locale)} />
          <Info label={t("profile.contractEnd")} value={fmt(e.contractEndDate, locale)} />
          <Info label={t("profile.probationStart")} value={fmt(e.probationStartDate, locale)} />
          <Info label={t("profile.probationEnd")} value={fmt(e.probationEndDate, locale)} />
        </CardContent>
      </Card>

      {chart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.scoreTrend")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.evalHistory", { n: evaluations.length })}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("profile.colTemplate")}</th>
                <th className="px-3 py-2 font-medium">{t("empForm.evaluator")}</th>
                <th className="px-3 py-2 font-medium">{t("profile.colScore")}</th>
                <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                <th className="px-3 py-2 font-medium">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{ev.template?.title ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ev.evaluator?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {ev.score != null ? `${ev.score}%` : "—"}
                  </td>
                  <td className="px-3 py-2">{t(`evalStatus.${ev.status}`)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(ev.submittedAt ?? ev.createdAt, locale)}</td>
                </tr>
              ))}
              {evaluations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("profile.noEvals")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: unknown; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{String(value)}</p>
      </CardContent>
    </Card>
  );
}
