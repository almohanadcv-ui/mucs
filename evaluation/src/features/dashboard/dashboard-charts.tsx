"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import type { DashboardStats } from "@/core/application/dashboard/dashboard-service";

const RATING_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const axisStyle = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

function tooltipStyle() {
  return {
    contentStyle: {
      background: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
      color: "hsl(var(--popover-foreground))",
    },
  } as const;
}

export function RatingDonut({
  data,
}: {
  data: DashboardStats["ratingDistribution"];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0)
    return <EmptyChart label="لا توجد تقييمات معتمدة بعد" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={RATING_COLORS[i % RATING_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle()} />
        <Legend
          formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>}
          wrapperStyle={{ direction: "rtl" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RatingBars({
  data,
}: {
  data: DashboardStats["ratingDistribution"];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} reversed />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} orientation="right" />
        <Tooltip {...tooltipStyle()} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={RATING_COLORS[i % RATING_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrend({
  data,
}: {
  data: DashboardStats["monthlyTrend"];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} reversed />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} orientation="right" />
        <Tooltip {...tooltipStyle()} />
        <Area
          type="monotone"
          dataKey="average"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#trendFill)"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
