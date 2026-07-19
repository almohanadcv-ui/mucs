import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { Sidebar } from "@/features/shell/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/features/auth/logout-button";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { getT } from "@/i18n/server";

const ROLE_LABEL_KEYS: Record<string, string> = {
  ADMIN: "topbar.roleAdmin",
  SUPERVISOR: "topbar.roleSupervisor",
  EVALUATOR: "topbar.roleEvaluator",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <RealtimeProvider />
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur print:hidden">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL_KEYS[user.role] ? t(ROLE_LABEL_KEYS[user.role]) : user.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
