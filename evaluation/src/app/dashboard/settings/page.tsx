import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { getT, getLocale } from "@/i18n/server";
import { prisma } from "@/infrastructure/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TwoFactorCard } from "@/features/settings/two-factor-card";

export const metadata: Metadata = { title: "الإعدادات" };
export const dynamic = "force-dynamic";

const ROLE_LABEL_KEYS: Record<string, string> = {
  ADMIN: "topbar.roleAdmin",
  SUPERVISOR: "topbar.roleSupervisor",
  EVALUATOR: "topbar.roleEvaluator",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const locale = await getLocale();

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true, lastLoginAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Settings className="size-6 text-primary" /> {t("settings.title")}
      </h1>

      <Card>
        <CardHeader><CardTitle>{t("settings.profile")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t("common.name")} value={user.name} />
          <Row label={t("empForm.email")} value={account.email} ltr />
          <Row label={t("settings.role")} value={ROLE_LABEL_KEYS[user.role] ? t(ROLE_LABEL_KEYS[user.role]) : user.role} />
          <Row
            label={t("settings.lastLogin")}
            value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
          />
        </CardContent>
      </Card>

      <TwoFactorCard enabled={account.twoFactorEnabled} />
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
