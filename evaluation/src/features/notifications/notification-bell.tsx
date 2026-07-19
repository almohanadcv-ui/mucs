"use client";

import { Bell, Check, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
} from "./use-notifications";
import { useT } from "@/i18n/client";

function useTimeAgo() {
  const t = useT();
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("notifications.now");
    if (m < 60) return t("notifications.minutesAgo", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("notifications.hoursAgo", { n: h });
    return t("notifications.daysAgo", { n: Math.floor(h / 24) });
  };
}

const TONE: Record<string, string> = {
  APPROVAL: "bg-success",
  REJECTION: "bg-destructive",
  ASSIGNMENT: "bg-primary",
  REMINDER: "bg-warning",
  SYSTEM: "bg-muted-foreground",
};

export function NotificationBell() {
  const t = useT();
  const timeAgo = useTimeAgo();
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();

  const items = data?.items ?? [];
  const unread = data?.meta.unread ?? items.filter((i) => !i.readAt).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={t("notifications.title")}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">{t("notifications.title")}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
              <CheckCheck className="size-4" /> {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 border-b px-4 py-3 text-sm last:border-0",
                  !n.readAt && "bg-accent/40",
                )}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[n.type] ?? "bg-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("notifications.markRead")}
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
