import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  UserCog,
  CalendarDays,
} from "lucide-react";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { getDashboardStats } from "@/core/application/dashboard/dashboard-service";
import { StatCard } from "@/features/dashboard/stat-card";
import { TopEmployeesWidget } from "@/features/dashboard/top-employees-widget";
import {
  RatingDonut,
  RatingBars,
  MonthlyTrend,
} from "@/features/dashboard/dashboard-charts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "لوحة المعلومات" };
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const stats = await getDashboardStats(user);
  const c = stats.counts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة المعلومات</h1>
        <p className="text-sm text-muted-foreground">
          نظرة عامة على التقييمات وأداء الفريق
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="الموظفون" value={c.employees} icon={Users} tone="primary" />
        <StatCard label="المقيّمون" value={c.evaluators} icon={UserCog} tone="primary" />
        <StatCard label="إجمالي التقييمات" value={c.evaluationsTotal} icon={ClipboardList} tone="primary" />
        <StatCard label="بانتظار الاعتماد" value={c.pending} icon={Clock} tone="warning" hint="تحتاج مراجعة" />
        <StatCard label="معتمدة" value={c.approved} icon={CheckCircle2} tone="success" />
        <StatCard label="مرفوضة" value={c.rejected} icon={XCircle} tone="destructive" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="متوسط الأداء" value={stats.averageScore ?? "—"} icon={Star} tone="success" hint="من 100" />
        <StatCard label="تقييمات اليوم" value={c.today} icon={CalendarDays} tone="muted" />
        <StatCard label="هذا الأسبوع" value={c.week} icon={CalendarDays} tone="muted" />
        <StatCard label="هذا الشهر" value={c.month} icon={CalendarDays} tone="muted" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>توزيع التقييمات حسب التقدير</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingDonut data={stats.ratingDistribution} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>متوسط التقييم خلال ٦ أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrend data={stats.monthlyTrend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>التقييمات حسب التقدير</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingBars data={stats.ratingDistribution} />
          </CardContent>
        </Card>

        <TopEmployeesWidget />
      </div>
    </div>
  );
}
