"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { withBase } from "@/lib/base-path";

export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("reset.tooShort"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(withBase("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.replace("/login"), 1800);
        return;
      }
      setError(json?.error?.message ?? t("reset.invalid"));
    } catch {
      setError(t("reset.invalid"));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("reset.noToken")}
        </p>
        <a href="/login" className="block text-center text-sm text-primary hover:underline">
          {t("reset.back")}
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <p>{t("reset.done")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">{t("reset.password")}</Label>
        <PasswordInput
          id="password"
          dir="ltr"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {busy ? t("reset.saving") : t("reset.submit")}
      </Button>
    </form>
  );
}
