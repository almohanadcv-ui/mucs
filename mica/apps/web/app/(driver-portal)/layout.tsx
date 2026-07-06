"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { DriverNav } from "@/components/layout/driver-nav";
import { useSession } from "@/lib/auth/session-context";

export default function DriverPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    // Non-drivers land here only via a stale bookmark/back-navigation —
    // send them to the admin dashboard instead. The real access boundary
    // is the driver-portal:* permission checks on the API.
    if (user && !user.roles.includes("Driver")) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || !user?.roles.includes("Driver")) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <Topbar hideSearch />
      <DriverNav />
      <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6">{children}</main>
    </div>
  );
}
