"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { useT } from "@/i18n/client";
import { can, type Permission } from "@/core/domain/permissions";
import type { Role } from "@/core/domain/enums";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const t = useT();
  const items = NAV_ITEMS.filter(
    (i) => !i.permission || can(role, i.permission as Permission),
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex print:hidden">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <span className="text-lg font-bold text-white">EMS</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const content = (
            <>
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {!item.ready && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-sidebar-foreground/70">
                  {t("nav.comingSoon")}
                </span>
              )}
            </>
          );
          const className = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
            !item.ready && "cursor-default opacity-60 hover:bg-transparent",
          );
          return item.ready ? (
            <Link key={item.href} href={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={item.href} className={className} aria-disabled>
              {content}
            </div>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl bg-white/5 p-4 text-center">
        <ShieldCheck className="mx-auto mb-2 size-6 text-success" />
        <p className="text-sm font-semibold text-white">{t("nav.protected")}</p>
        <p className="text-xs text-sidebar-foreground/60">{t("nav.protectedDesc")}</p>
      </div>
    </aside>
  );
}
