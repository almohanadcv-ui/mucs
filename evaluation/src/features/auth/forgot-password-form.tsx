"use client";

import { useState } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { withBase } from "@/lib/base-path";

export function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Always resolves the same way; the server never reveals if the email exists.
      await fetch(withBase("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>{t("forgot.sent")}</p>
        </div>
        <a href="/login" className="block text-center text-sm text-primary hover:underline">
          {t("forgot.back")}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          required
          placeholder="admin@ems.local"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy || !email}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {t("forgot.submit")}
      </Button>
      <a href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
        {t("forgot.back")}
      </a>
    </form>
  );
}
