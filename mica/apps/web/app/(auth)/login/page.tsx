"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput, type LoginResponse } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth/session-context";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyTwoFactor } = useSession();
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      const response = await login(values);
      // Keyed on passwordResetToken, not mustChangePassword: the latter is an
      // optional `false` on the success branch, so `in` does not narrow it out.
      if ("passwordResetToken" in response) {
        toast.info(t("mustChangePassword"));
        router.push(`/reset-password?token=${response.passwordResetToken}`);
        return;
      }
      if ("requiresTwoFactor" in response) {
        // Password accepted, session withheld until the emailed code arrives.
        setChallengeId(response.challengeId);
        return;
      }

      finish(response);
    } catch (error) {
      setServerError(readError(error));
    }
  };

  /** Shared by both steps: the code path lands in the same place the password path would. */
  function finish(response: Extract<LoginResponse, { accessToken: string }>) {
    toast.success(t("welcomeBack"));
    const home = response.user.roles.includes("Driver") ? "/driver/vehicles" : "/dashboard";
    // Returns the manager to the invoice their email link pointed at. Read at
    // submit time rather than via useSearchParams: the hook forces the page out
    // of static prerendering, and by now we are certainly in the browser.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(safeRedirect(next, home));
  }

  function readError(error: unknown): string {
    if (!isAxiosError(error)) return "Something went wrong. Please try again.";
    // No HTTP response at all (server down, network error) — distinct from a
    // real 401, which previously both fell through to the same "Invalid email
    // or password" message and misled users into thinking their credentials
    // were wrong when the API was just down.
    if (!error.response) return t("cantReachServer");
    return (error.response.data as { message?: string })?.message ?? t("invalidCredentials");
  }

  const submitCode = async () => {
    setServerError(null);
    setVerifying(true);
    try {
      const response = await verifyTwoFactor(challengeId!, code);
      if ("accessToken" in response) finish(response);
    } catch (error) {
      setServerError(readError(error));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  // Second step: the password is already accepted and a code is in the user's
  // inbox. Rendered instead of the credentials form, not alongside it, so
  // there is one thing to do on the screen.
  if (challengeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("twoFactorTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("twoFactorSent")}</p>
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">{t("twoFactorCode")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              // Digits only, and the phone keypad on mobile. autoComplete lets
              // iOS and Android offer the code straight from the notification.
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              dir="ltr"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000"
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) submitCode();
              }}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button
            className="w-full"
            onClick={submitCode}
            disabled={code.length !== 6 || verifying}
          >
            {verifying ? t("signingIn") : t("twoFactorVerify")}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setChallengeId(null);
              setCode("");
              setServerError(null);
            }}
          >
            {t("twoFactorBack")}
          </button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signIn")}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pe-10"
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 end-0 h-full rounded-s-none"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="rememberMe"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label htmlFor="rememberMe" className="font-normal">
                {t("rememberMe")}
              </Label>
            </div>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              {t("forgotPassword")}
            </Link>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("signingIn") : t("signIn")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
