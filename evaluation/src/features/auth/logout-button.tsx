"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // The QueryClient lives for the whole browser tab, so without this the next
    // person to sign in on this device is served the previous user's cached
    // employees and dashboard until each query refetches. That is data they may
    // have no right to see, so it must not outlive the session.
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout} disabled={loading}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      {t("logout")}
    </Button>
  );
}
