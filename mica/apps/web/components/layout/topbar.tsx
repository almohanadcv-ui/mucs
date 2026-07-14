"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Moon, Search, Sun, LogOut, Languages, KeyRound } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth/session-context";
import { useLocale } from "@/lib/i18n/locale-context";
import { NotificationBell } from "./notification-bell";

export function Topbar({
  onMenuClick,
  hideSearch,
}: {
  onMenuClick?: () => void;
  hideSearch?: boolean;
}) {
  const { user, logout } = useSession();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useTranslations("topbar");
  const router = useRouter();

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "";

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b px-2 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="فتح القائمة"
      >
        <Menu className="size-5" />
      </Button>
      {hideSearch ? (
        <span />
      ) : (
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground sm:w-64"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search className="size-4" />
          <span className="truncate">{t("searchPlaceholder")}</span>
          <kbd className="ms-auto hidden rounded border bg-muted px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
        </Button>
      )}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          aria-label="تغيير اللغة"
          title={locale === "en" ? "العربية" : "English"}
        >
          <Languages className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("toggleTheme")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {user?.roles.join(", ")}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/change-password">
                <KeyRound className="size-4" />
                تغيير كلمة المرور
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
