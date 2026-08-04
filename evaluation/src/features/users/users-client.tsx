"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, UserCog, Loader2, Trash2, ShieldCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type UserRow,
} from "./use-users";
import { useT } from "@/i18n/client";

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function UsersClient() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [toDelete, setToDelete] = useState<UserRow | null>(null);
  const { data, isLoading } = useUsers({ page: 1 });
  const create = useCreateUser();
  const del = useDeleteUser();
  const rows = data?.items ?? [];

  const { register, handleSubmit, setValue, reset } = useForm<CreateForm>({
    defaultValues: { role: "EVALUATOR" },
  });

  async function onCreate(v: CreateForm) {
    try {
      await create.mutateAsync(v);
      toast.success(t("users.created"));
      reset({ role: "EVALUATOR" });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("users.createFailed"));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(t("users.deleted"));
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("common.saveFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <UserCog className="size-6 text-primary" /> {t("users.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("users.count", { n: data?.meta.total ?? 0 })}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {t("users.new")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("common.name")}</th>
                    <th className="px-3 py-2 font-medium">{t("users.colEmail")}</th>
                    <th className="px-3 py-2 font-medium">{t("users.colRole")}</th>
                    <th className="px-3 py-2 font-medium">2FA</th>
                    <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3 font-medium">{u.name}</td>
                      <td className="px-3 py-3 text-muted-foreground" dir="ltr">{u.email}</td>
                      <td className="px-3 py-3"><Badge>{t(`users.role${u.role === "ADMIN" ? "Admin" : u.role === "MANAGEMENT" ? "Management" : u.role === "SUPERVISOR" ? "Supervisor" : "Evaluator"}`)}</Badge></td>
                      <td className="px-3 py-3">
                        {u.twoFactorEnabled ? (
                          <ShieldCheck className="size-4 text-success" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={u.isActive ? "success" : "muted"}>
                          {u.isActive ? t("users.active") : t("users.disabled")}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            title={t("users.edit")}
                            onClick={() => setEditing(u)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="text-destructive"
                            title={t("templates.confirm")}
                            onClick={() => setToDelete(u)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.new")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>{t("empForm.email")}</Label>
              <Input type="email" dir="ltr" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>{t("users.passwordLabel")}</Label>
              <PasswordInput dir="ltr" {...register("password", { required: true, minLength: 8 })} />
            </div>
            <div className="space-y-2">
              <Label>{t("users.roleLabel")}</Label>
              <Select defaultValue="EVALUATOR" onValueChange={(v) => setValue("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVALUATOR">{t("users.roleEvaluator")}</SelectItem>
                  <SelectItem value="MANAGEMENT">{t("users.roleManagement")}</SelectItem>
                  <SelectItem value="SUPERVISOR">{t("users.roleSupervisor")}</SelectItem>
                  <SelectItem value="ADMIN">{t("users.roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="size-4 animate-spin" />} {t("users.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog — keyed so it re-initialises per user without an effect */}
      {editing && (
        <EditUserDialog key={editing.id} user={editing} onClose={() => setEditing(null)} />
      )}

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("users.deleteTitle")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("users.deleteConfirm", { name: toDelete?.name ?? "" })}</p>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="size-4 animate-spin" />} {t("templates.confirm")}
            </Button>
            <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * IT-only editor for an existing account: change email, role and active state,
 * and set a new password (left blank keeps the current one). Its own component
 * so the update mutation can bind to the selected user's id.
 */
function EditUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const t = useT();
  const update = useUpdateUser(user.id);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");

  async function save() {
    try {
      const body: Record<string, unknown> = { email, role, isActive };
      if (password.trim()) body.password = password.trim();
      await update.mutateAsync(body);
      toast.success(t("users.updated"));
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("common.saveFailed"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.editTitle", { name: user.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("users.colEmail")}</Label>
            <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("users.roleLabel")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EVALUATOR">{t("users.roleEvaluator")}</SelectItem>
                <SelectItem value="MANAGEMENT">{t("users.roleManagement")}</SelectItem>
                <SelectItem value="SUPERVISOR">{t("users.roleSupervisor")}</SelectItem>
                <SelectItem value="ADMIN">{t("users.roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("users.newPasswordOptional")}</Label>
            <PasswordInput dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label>{t("users.activeAccount")}</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />} {t("common.save")}
          </Button>
          <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
