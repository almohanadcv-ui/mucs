"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSession();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // Carries the destination through login, so an emailed invoice link
      // survives the detour instead of dropping the manager on the dashboard.
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    // Drivers get their own stripped-down portal — the admin shell (and its
    // nav items) is unreachable to them anyway via permissions, but this
    // avoids landing them on an almost-empty dashboard.
    if (user && user.roles.includes("Driver")) {
      router.replace("/driver/vehicles");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!isAuthenticated || user?.roles.includes("Driver")) return null;

  return (
    <div className="flex flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-e lg:block">
        <SidebarNav />
      </aside>

      {/* Tablet/mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileNavOpen ? "" : "pointer-events-none")}>
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            mobileNavOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 start-0 w-72 max-w-[80%] border-e bg-background shadow-xl transition-transform",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          )}
        >
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
