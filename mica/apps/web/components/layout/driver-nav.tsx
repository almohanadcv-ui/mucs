"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Car, FilePlus, ListChecks, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverNavItem {
  href: string;
  labelKey?: string;
  label?: string; // literal fallback when there is no i18n key
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: DriverNavItem[] = [
  { href: "/driver/vehicles", labelKey: "myVehicles", icon: Car },
  { href: "/driver/reports/new", labelKey: "newReport", icon: FilePlus },
  { href: "/driver/reports", labelKey: "myReports", icon: ListChecks },
  { href: "/driver/photo-requests", label: "طلبات التصوير", icon: Camera },
  { href: "/driver/profile", labelKey: "profile", icon: User },
];

export function DriverNav() {
  const pathname = usePathname();
  const t = useTranslations("driverPortal.nav");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background lg:static lg:border-b lg:border-t-0">
      <div className="mx-auto flex max-w-3xl items-center justify-around lg:justify-start lg:gap-2 lg:px-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors lg:flex-none lg:flex-row lg:gap-2 lg:rounded-md lg:px-3 lg:py-2.5",
                active
                  ? "text-primary lg:bg-primary lg:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{item.label ?? (item.labelKey ? t(item.labelKey) : item.href)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
