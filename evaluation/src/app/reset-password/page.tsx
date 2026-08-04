import { Suspense } from "react";
import { MabLogo } from "@/components/mab-logo";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("reset.title") };
}

export default async function ResetPasswordPage() {
  const t = await getT();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MabLogo className="h-7 w-auto" />
            <span className="text-lg font-bold">EMS</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("reset.title")}</CardTitle>
            <CardDescription>{t("reset.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}
            >
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
