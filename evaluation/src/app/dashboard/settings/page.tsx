import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TwoFactorCard } from "@/features/settings/two-factor-card";

export const metadata: Metadata = { title: "الإعدادات" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  SUPERVISOR: "مشرف",
  EVALUATOR: "مقيّم",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true, lastLoginAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Settings className="size-6 text-primary" /> الإعدادات
      </h1>

      <Card>
        <CardHeader><CardTitle>الملف الشخصي</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="الاسم" value={user.name} />
          <Row label="البريد الإلكتروني" value={account.email} ltr />
          <Row label="الدور" value={ROLE_LABELS[user.role] ?? user.role} />
          <Row
            label="آخر تسجيل دخول"
            value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString("ar-EG") : "—"}
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
