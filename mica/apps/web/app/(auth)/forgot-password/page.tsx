"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordRequest } from "@/features/auth/api";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordInput) => {
    await forgotPasswordRequest(values.email);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("checkEmail")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("resetSent")}</p>
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
        <CardTitle>{t("forgotTitle")}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("sending") : t("sendResetLink")}
          </Button>
          <Link href="/login" className="text-sm text-primary hover:underline">
            {t("backToSignIn")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
