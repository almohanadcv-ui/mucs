"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";

const formSchema = z.object({
  email: z.string().email("login.invalidEmail"),
  password: z.string().min(1, "login.passwordRequired"),
  totp: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => null);

    if (res.ok) {
      // Also cleared here, not only on logout: a session can end without the
      // logout button (expiry, a second tab, back-button into the login page),
      // and whoever signs in next must never inherit the previous user's cache.
      queryClient.clear();
      const next = params.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
      return;
    }

    const code = json?.error?.code as string | undefined;
    if (code === "TWO_FACTOR_REQUIRED") {
      setNeedsTotp(true);
      setServerError(t("login.totpHint"));
      return;
    }
    setServerError(json?.error?.message ?? t("login.failed"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          dir="ltr"
          placeholder="admin@ems.local"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{t(errors.email.message ?? "")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("login.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{t(errors.password.message ?? "")}</p>
        )}
      </div>

      {needsTotp && (
        <div className="space-y-2">
          <Label htmlFor="totp">{t("login.totp")}</Label>
          <Input
            id="totp"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            placeholder="123456"
            {...register("totp")}
          />
        </div>
      )}

      {serverError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
