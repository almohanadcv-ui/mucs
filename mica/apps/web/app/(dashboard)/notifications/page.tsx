"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => listNotifications(1, 50),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Approval requests, assignments, and updates.</p>
        </div>
        <Button variant="outline" onClick={() => markAllMutation.mutate()}>
          Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

        {!isLoading && data?.items.length === 0 && (
          <p className="text-center text-muted-foreground">No notifications yet.</p>
        )}

        {data?.items.map((notification) => (
          <Card
            key={notification.id}
            className={notification.readAt ? "opacity-60" : undefined}
            onClick={() => !notification.readAt && markReadMutation.mutate(notification.id)}
          >
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge variant={notification.channel === "EMAIL" ? "secondary" : "outline"}>
                {notification.channel}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
