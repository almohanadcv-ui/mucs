"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEvaluations } from "./use-evaluations";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("ar-EG") : "—";
}

export function ApprovalsClient() {
  const { data, isLoading } = useEvaluations({ status: "PENDING", page: 1 });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CheckCircle2 className="size-6 text-primary" /> الاعتمادات
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.meta.total ?? 0} تقييم بانتظار المراجعة
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">لا توجد تقييمات بانتظار الاعتماد 🎉</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-semibold">{e.employee?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.template?.title} · المقيّم: {e.evaluator?.name} · {fmt(e.submittedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {e.score != null && (
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <Star className="size-4 fill-current" /> {e.score}
                    </span>
                  )}
                  <Button asChild size="sm">
                    <Link href={`/dashboard/evaluations/${e.id}`}>مراجعة</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
