import { Suspense } from "react";
import Link from "next/link";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <MabLogo className="h-8 w-auto" />
          <span className="text-lg font-bold">EMS</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            نظام إدارة تقييم الموظفين والمتدربين
          </h2>
          <p className="max-w-md text-sidebar-foreground/70">
            منصّة احترافية بواجهات عربية كاملة، لوحات معلومات غنية، وأعلى معايير
            الأمان — جاهزة للتوسع كخدمة SaaS.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} EMS. جميع الحقوق محفوظة.
        </p>
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <MabLogo className="h-7 w-auto" />
              <span className="text-lg font-bold">EMS</span>
            </div>
            <ThemeToggle />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">مرحباً بعودتك</CardTitle>
              <CardDescription>
                سجّل الدخول للوصول إلى لوحة التحكم.
              </CardDescription>
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
              <p className="mt-6 text-center text-xs text-muted-foreground">
                بالدخول أنت توافق على{" "}
                <Link href="/" className="text-primary hover:underline">
                  سياسة الاستخدام
                </Link>
              </p>
            </CardContent>
          </Card>
          <div className="mt-4 hidden justify-end lg:flex">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
