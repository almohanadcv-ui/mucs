"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Calendar,
  Car,
  DatabaseBackup,
  FileText,
  Hammer,
  IdCard,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Webhook,
  Wrench,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermission } from "@/lib/auth/use-permission";

interface NavItem {
  href: string;
  labelKey: "workshop" | "dashboard" | "vehicles" | "invoices" | "drivers" | "maintenance" | "myRequests" | "spareParts" | "appointments" | "reports" | "users" | "roles" | "settings" | "apiKeys" | "webhooks" | "backups" | "trash";
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/workshop", labelKey: "workshop", icon: Hammer, permission: "vehicles:create" },
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/vehicles", labelKey: "vehicles", icon: Car, permission: "vehicles:view" },
  { href: "/invoices", labelKey: "invoices", icon: FileText, permission: "invoices:view" },
  { href: "/drivers", labelKey: "drivers", icon: IdCard, permission: "drivers:view" },
  { href: "/my-requests", labelKey: "myRequests", icon: Inbox, permission: "maintenance:view" },
  { href: "/maintenance", labelKey: "maintenance", icon: Wrench, permission: "maintenance:view" },
  { href: "/spare-parts", labelKey: "spareParts", icon: Cog, permission: "spare-parts:view" },
  { href: "/appointments", labelKey: "appointments", icon: Calendar, permission: "appointments:view" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, permission: "reports:view" },
  { href: "/users", labelKey: "users", icon: Users, permission: "users:view" },
  { href: "/roles", labelKey: "roles", icon: ShieldCheck, permission: "roles:view" },
  { href: "/settings", labelKey: "settings", icon: Settings, permission: "settings:view" },
  { href: "/api-keys", labelKey: "apiKeys", icon: KeyRound, permission: "api-keys:view" },
  { href: "/webhooks", labelKey: "webhooks", icon: Webhook, permission: "webhooks:view" },
  { href: "/backups", labelKey: "backups", icon: DatabaseBackup, permission: "backups:view" },
  { href: "/trash", labelKey: "trash", icon: Trash2, permission: "vehicles:delete" },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
          MM
        </span>
        MICA MAB
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const hasPermission = usePermission(item.permission ?? "");
  if (item.permission && !hasPermission) return null;

  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        // Larger touch targets (py-2.5) so the nav is comfortable on a tablet.
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="size-5" />
      {t(item.labelKey)}
    </Link>
  );
}
