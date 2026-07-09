"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth/token-store";
import { useSession } from "@/lib/auth/session-context";
import type { NotificationItem } from "@/features/notifications/api";

/** Connects to the notifications gateway and invalidates React Query caches on push, for live unread-count/list updates without polling. */
export function useNotificationSocket() {
  const { isAuthenticated } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const socket = io(`${baseUrl}/notifications`, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("notification", (notification: NotificationItem) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Live-refresh the request/maintenance surfaces ("طلباتي") so new reports,
      // approvals, comments and status changes appear without a page refresh.
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["driver-portal"] });
      queryClient.invalidateQueries({ queryKey: ["photo-requests"] });
      if (notification.channel === "IN_APP") {
        toast.info(notification.title, { description: notification.body });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient]);
}
