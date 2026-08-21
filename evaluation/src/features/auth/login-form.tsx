"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck, MailCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { withBase } from "@/lib/base-path";

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

  // Second step: after the password check the server emails a code and returns
  // a challenge id. We hold it (plus the credentials, to allow "resend") and
  // swap the form over to code entry.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [creds, setCreds] = useState<FormValues | null>(null);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  /** Land a minted session: clear per-user cache and go to the dashboard. */
  function finishSignedIn() {
    // A session can end without the logout button (expiry, a second tab, the
    // back button into login), and whoever signs in next must never inherit the
    // previous user's cache.
    queryClient.clear();
    const next = params.get("next") || "/dashboard";
    router.replace(next);
    router.refresh();
  }

  /** Post credentials → server verifies the password and emails a code. */
  async function requestCode(values: FormValues): Promise<boolean> {
    const res = await fetch(withBase("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => null);

    if (res.ok && json?.data?.challengeRequired) {
      setChallengeId(json.data.challengeId as string);
      setCreds(values);
      setCode("");
      return true;
    }

    const errCode = json?.error?.code as string | undefined;
    if (errCode === "TWO_FACTOR_REQUIRED") {
      setNeedsTotp(true);
      setServerError(t("login.totpHint"));
      return false;
    }
    setServerError(json?.error?.message ?? t("login.failed"));
    return false;
  }

  async function onSubmitCredentials(values: FormValues) {
    setServerError(null);
    setInfo(null);
    await requestCode(values);
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setInfo(null);
    if (!/^\d{6}$/u.test(code)) {
      setServerError(t("login.codeInvalidLen"));
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(withBase("/api/auth/login/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        finishSignedIn();
        return;
      }
      setServerError(json?.error?.message ?? t("login.failed"));
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (!creds) return;
    setServerError(null);
    setInfo(null);
    setResending(true);
    try {
      const okSent = await requestCode(creds);
      if (okSent) setInfo(t("login.resent"));
    } finally {
      setResending(false);
    }
  }

  function backToCredentials() {
    setChallengeId(null);
    setCode("");
    setServerError(null);
    setInfo(null);
  }

  // ── Step 2: verification code ──────────────────────────────────────────────
  if (challengeId) {
    return (
      <form onSubmit={onSubmitCode} className="space-y-4" noValidate>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MailCheck className="size-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">{t("login.codeTitle")}</p>
            <p>{t("login.codeSent")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">{t("login.codeLabel")}</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            autoFocus
            placeholder="______"
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>

        {info && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            {info}
          </div>
        )}
        {serverError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {verifying ? t("login.verifying") : t("login.verify")}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={backToCredentials}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("login.back")}
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
          >
            {resending && <Loader2 className="size-3 animate-spin" />}
            {t("login.resend")}
            <ArrowRight className="size-3" />
          </button>
        </div>
      </form>
    );
  }

  // ── Step 1: credentials ─────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmitCredentials)} className="space-y-4" noValidate>
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
        <PasswordInput
          id="password"
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

      <div className="text-center">
        <a href="/forgot-password" className="text-sm text-primary hover:underline">
          {t("login.forgot")}
        </a>
      </div>
    </form>
  );
}
