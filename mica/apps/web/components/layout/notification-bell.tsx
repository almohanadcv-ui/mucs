"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  unreadNotificationCount,
  type NotificationItem,
} from "@/features/notifications/api";
import { useNotificationSocket } from "@/lib/notifications/use-notification-socket";
import { useSession } from "@/lib/auth/session-context";

/** Route a notification to the exact entity it's about, by payload/type. */
function notificationHref(n: NotificationItem, isDriver: boolean): string | null {
  const p = n.payload ?? {};
  if (typeof p.maintenanceRequestId === "string")
    return isDriver ? `/driver/reports/${p.maintenanceRequestId}` : `/maintenance/${p.maintenanceRequestId}`;
  if (typeof p.invoiceId === "string") return "/invoices";
  if (n.type?.startsWith("appointment")) return "/appointments";
  if (typeof p.photoRequestId === "string") return isDriver ? "/driver/photo-requests" : "/vehicles";
  if (typeof p.vehicleId === "string") return isDriver ? "/driver/vehicles" : `/vehicles/${p.vehicleId}`;
  if (n.type?.startsWith("vehicle")) return isDriver ? "/driver/vehicles" : "/vehicles";
  return null;
}

export function NotificationBell() {
  useNotificationSocket();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useSession();
  const isDriver = user?.roles.includes("Driver") ?? false;

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: unreadNotificationCount,
    refetchInterval: 60_000,
  });

  const { data } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => listNotifications(1, 5),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (notification: NotificationItem) => {
    if (!notification.readAt) markReadMutation.mutate(notification.id);
    const href = notificationHref(notification, isDriver);
    if (href) router.push(href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {!!unreadCount && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>الإشعارات</span>
          {!!unreadCount && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                markAllMutation.mutate();
              }}
              className="text-xs font-normal text-primary hover:underline"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!data?.items.length && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">لا توجد إشعارات</p>
        )}
        {data?.items.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            className="flex flex-col items-start gap-0.5 whitespace-normal"
            onClick={() => handleClick(notification)}
          >
            <span className={notification.readAt ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
              {notification.title}
            </span>
            <span className="text-xs text-muted-foreground">{notification.body}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="w-full text-center text-sm">
            عرض جميع الإشعارات
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
