"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/client";

interface TopEmp {
  id: string;
  name: string;
  employeeNo: string;
  department: string | null;
  average: number;
  count: number;
}

const THRESHOLDS = ["99", "95", "90", "80", "0"];

/** Dashboard widget: the top 10 employees whose average score meets a
 *  reviewer-configurable threshold (99% / 95% / 90% …). */
export function TopEmployeesWidget() {
  const t = useT();
  const [threshold, setThreshold] = useState("90");
  const { data, isLoading } = useQuery({
    queryKey: ["top-employees", threshold],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/top-employees?threshold=${threshold}`);
      const b = await res.json().catch(() => null);
      return ((b?.data ?? b) as TopEmp[]) ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-5 text-amber-500" /> {t("widgets.topEmployees")}
        </CardTitle>
        <Select value={threshold} onValueChange={setThreshold}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THRESHOLDS.map((th) => (
              <SelectItem key={th} value={th}>
                {th === "0" ? t("common.all") : t("widgets.orMore", { n: th })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("widgets.noneInThreshold")}
          </p>
        ) : (
          <ol className="space-y-1">
            {data!.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/employees/${e.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        i < 3
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.department ?? e.employeeNo} · {t("widgets.evaluationsCount", { n: e.count })}
                      </span>
                    </span>
                  </span>
                  <span className="font-bold tabular-nums text-primary">{e.average}%</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
