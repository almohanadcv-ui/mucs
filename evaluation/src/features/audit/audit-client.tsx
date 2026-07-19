"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { apiClient, qs, type PaginatedResponse } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/client";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { name: string } | null;
}

const ACTION_KEYS = ["CREATE","UPDATE","DELETE","LOGIN","LOGOUT","LOGIN_FAILED","APPROVE","REJECT","EXPORT"];
const ACTION_TONE: Record<string, "success" | "warning" | "destructive" | "muted" | "default"> = {
  CREATE: "success", APPROVE: "success", UPDATE: "default", EXPORT: "default",
  DELETE: "destructive", REJECT: "destructive", LOGIN_FAILED: "destructive",
  LOGIN: "muted", LOGOUT: "muted",
};
const ALL = "__all__";

export function AuditClient() {
  const { t, locale } = useI18n();
  const [action, setAction] = useState(ALL);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", action, page],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AuditRow>>(
        "/api/audit" + qs({ page, action: action === ALL ? undefined : action }),
      ),
    placeholderData: (p) => p,
  });

  const rows = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History className="size-6 text-primary" /> {t("audit.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("audit.count", { n: meta?.total ?? 0 })}</p>
        </div>
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("audit.allActions")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("audit.allActions")}</SelectItem>
            {ACTION_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{t(`audit.${k}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("audit.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("audit.colAction")}</th>
                    <th className="px-3 py-2 font-medium">{t("audit.colEntity")}</th>
                    <th className="px-3 py-2 font-medium">{t("audit.colUser")}</th>
                    <th className="px-3 py-2 font-medium">IP</th>
                    <th className="px-3 py-2 font-medium">{t("common.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3">
                        <Badge variant={ACTION_TONE[r.action] ?? "muted"}>
                          {t(`audit.${r.action}`)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-3 py-3">{r.actor?.name ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground" dir="ltr">{r.ip ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("common.pageOf", { page: meta.page, total: meta.totalPages })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
