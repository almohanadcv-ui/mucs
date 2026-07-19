"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/client";

interface Result {
  user: { id: string; name: string; email: string; role: string };
  linkedCount: number;
  temporaryPassword: string;
}

/**
 * Create a login for a direct-manager/evaluator by name. On success their team
 * (employees imported with a matching «المدير المباشر») is auto-linked, and the
 * one-time email + password are shown to hand over.
 */
export function CreateManagerDialog({ canCreateSupervisor }: { canCreateSupervisor?: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EVALUATOR");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function resetAll() {
    setName("");
    setEmail("");
    setRole("EVALUATOR");
    setResult(null);
  }

  async function submit() {
    if (name.trim().length < 2) return toast.error(t("manager.nameRequired"));
    setLoading(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, role }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? t("manager.createFailed"));
      setResult((body.data ?? body) as Result);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["lookups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("manager.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="size-4" /> {t("manager.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("manager.title")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>{t("manager.linkedResult", { n: result.linkedCount })}</span>
            </div>
            <CopyRow label={t("empForm.email")} value={result.user.email} copiedMsg={t("manager.copied")} />
            <CopyRow label={t("manager.tempPassword")} value={result.temporaryPassword} copiedMsg={t("manager.copied")} />
            <p className="text-xs text-muted-foreground">
              {t("manager.handover")}
            </p>
            <DialogFooter>
              <Button
                onClick={() => {
                  resetAll();
                }}
                variant="outline"
              >
                {t("manager.addAnother")}
              </Button>
              <Button onClick={() => setOpen(false)}>{t("manager.done")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input
                placeholder={t("manager.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("manager.nameHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("manager.emailOptional")}</Label>
              <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {canCreateSupervisor && (
              <div className="space-y-2">
                <Label>{t("manager.role")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVALUATOR">{t("manager.roleEvaluator")}</SelectItem>
                    <SelectItem value="SUPERVISOR">{t("manager.roleSupervisor")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button onClick={submit} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />} {t("manager.createAndLink")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({ label, value, copiedMsg }: { label: string; value: string; copiedMsg: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input dir="ltr" readOnly value={value} className="font-mono text-sm" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success(copiedMsg);
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}
