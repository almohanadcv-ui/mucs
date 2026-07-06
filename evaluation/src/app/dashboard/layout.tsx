import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { Sidebar } from "@/features/shell/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/logout-button";
import { NotificationBell } from "@/features/notifications/notification-bell";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  SUPERVISOR: "مشرف",
  EVALUATOR: "مقيّم",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-muted/30">
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
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
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
