"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { resetPasswordSchema, type ResetPasswordInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordRequest } from "@/features/auth/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "" },
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    setServerError(null);
    try {
      await resetPasswordRequest(values.token, values.password);
      toast.success(t("passwordSet"));
      router.push("/login");
    } catch (error) {
      let message = t("invalidLink");
      if (isAxiosError(error)) {
        message = !error.response
          ? t("cantReachServer")
          : (error.response.data as { message?: string })?.message ?? t("invalidLinkBody");
      }
      setServerError(message);
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("invalidLink")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("invalidLinkBody")}</p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="text-sm text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("setPassword")}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? tc("saving") : t("setPassword")}
          </Button>
          <Link href="/login" className="text-sm text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
