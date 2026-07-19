"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient, ApiError } from "@/lib/api-client";
import { useT } from "@/i18n/client";

type SetupData = { secret: string; otpauth: string; qrDataUrl: string };

export function TwoFactorCard({ enabled: initialEnabled }: { enabled: boolean }) {
  const t = useT();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    try {
      setSetup(await apiClient.post<SetupData>("/api/auth/2fa/setup"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("twofa.startFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      const res = await apiClient.post<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", { token });
      setRecovery(res.recoveryCodes);
      setEnabled(true);
      setSetup(null);
      setToken("");
      toast.success(t("twofa.enabledToast"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("twofa.invalidCode"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await apiClient.post("/api/auth/2fa/disable", { password });
      setEnabled(false);
      setPassword("");
      toast.success(t("twofa.disabledToast"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("twofa.disableFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> {t("twofa.title")}
            </CardTitle>
            <CardDescription>{t("twofa.desc")}</CardDescription>
          </div>
          <Badge variant={enabled ? "success" : "muted"}>
            {enabled ? t("twofa.enabled") : t("twofa.disabled")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recovery && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="mb-2 text-sm font-medium">{t("twofa.recoveryTitle")}</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm" dir="ltr">
              {recovery.map((c) => <span key={c} className="rounded bg-card px-2 py-1">{c}</span>)}
            </div>
          </div>
        )}

        {!enabled && !setup && (
          <Button onClick={startSetup} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {t("twofa.enableBtn")}
          </Button>
        )}

        {!enabled && setup && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("twofa.scanInstructions")}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <Image src={setup.qrDataUrl} alt="QR" width={180} height={180} className="rounded-lg border bg-white p-2" />
              <div className="space-y-2">
                <Label className="text-xs">{t("twofa.manualKey")}</Label>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs" dir="ltr">{setup.secret}</code>
                  <Button
                    variant="ghost" size="icon" className="size-7"
                    onClick={() => { navigator.clipboard.writeText(setup.secret); toast.success(t("manager.copied")); }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("twofa.verifyCode")}</Label>
                <Input dir="ltr" inputMode="numeric" maxLength={6} className="w-32"
                  value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" />
              </div>
              <Button onClick={confirmEnable} disabled={busy || token.length !== 6}>
                {busy && <Loader2 className="size-4 animate-spin" />} {t("templates.confirm")}
              </Button>
            </div>
          </div>
        )}

        {enabled && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("twofa.disablePassword")}</Label>
              <Input type="password" dir="ltr" className="w-56"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button variant="destructive" onClick={disable} disabled={busy || !password}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
              {t("twofa.disableBtn")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
