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
import { loginSchema, type LoginInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth/session-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      if (response.mustChangePassword) {
        toast.info(t("mustChangePassword"));
        router.push(`/reset-password?token=${response.passwordResetToken}`);
        return;
      }

      toast.success(t("welcomeBack"));
      router.push(response.user.roles.includes("Driver") ? "/driver/vehicles" : "/dashboard");
    } catch (error) {
      let message = "Something went wrong. Please try again.";
      if (isAxiosError(error)) {
        if (!error.response) {
          // No HTTP response at all (server down, network error) — distinct
          // from a real 401, which previously both fell through to the same
          // "Invalid email or password" message and misled users into
          // thinking their credentials were wrong when the API was just down.
          message = t("cantReachServer");
        } else {
          message =
            (error.response.data as { message?: string })?.message ?? t("invalidCredentials");
        }
      }
      setServerError(message);
    }
  };

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
