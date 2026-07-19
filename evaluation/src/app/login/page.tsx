import { Suspense } from "react";
import type { Metadata } from "next";
import { MabLogo } from "@/components/mab-logo";
import { LoginForm } from "@/features/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MabLogo className="h-7 w-auto" />
            <span className="text-lg font-bold">EMS</span>
          </div>
          <ThemeToggle />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">مرحباً بعودتك</CardTitle>
            <CardDescription>سجّل الدخول للوصول إلى لوحة التحكم.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="space-y-4" aria-hidden>
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-primary/30" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
