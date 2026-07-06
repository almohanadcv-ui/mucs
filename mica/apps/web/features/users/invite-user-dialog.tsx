"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { createUserSchema, type CreateUserInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listRoles } from "@/features/roles/api";
import { createUser, type CreatedUser } from "./api";

interface InviteUserDialogProps {
  /** Custom trigger element; defaults to the standard "Invite" button.
   *  Omit both this and `open`/`onOpenChange` unset to get the default button. */
  trigger?: React.ReactNode;
  /** Controlled open state — for triggering the dialog from outside (e.g. a
   *  dropdown menu item elsewhere on the page) instead of via `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-selects this role and hides the role picker — used when inviting a
   *  user for a specific narrow purpose (e.g. linking a Driver login). */
  lockedRoleName?: string;
  defaultValues?: Partial<Pick<CreateUserInput, "firstName" | "lastName">>;
  onInvited?: (user: CreatedUser) => void;
}

export function InviteUserDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  lockedRoleName,
  defaultValues,
  onInvited,
}: InviteUserDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPassword: string;
    setPasswordUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const t = useTranslations("users");
  const queryClient = useQueryClient();

  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: listRoles, enabled: open });
  const lockedRole = lockedRoleName ? roles?.find((r) => r.name === lockedRoleName) : undefined;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      firstName: defaultValues?.firstName ?? "",
      lastName: defaultValues?.lastName ?? "",
      roleIds: [],
    },
  });

  useEffect(() => {
    if (lockedRole) setValue("roleIds", [lockedRole.id]);
  }, [lockedRole, setValue]);

  // With a controlled `open`, this instance stays mounted across different
  // callers (e.g. one row's driver, then another's) — reset the identity
  // fields whenever it opens so stale values from a previous open don't leak in.
  useEffect(() => {
    if (open) {
      reset({
        email: "",
        firstName: defaultValues?.firstName ?? "",
        lastName: defaultValues?.lastName ?? "",
        roleIds: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      toast.success(t("invitedToast"));
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCredentials({
        email: user.email,
        temporaryPassword: user.temporaryPassword,
        setPasswordUrl: user.setPasswordUrl,
      });
      reset();
      onInvited?.(user);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("inviteFailed")
        : t("inviteFailed");
      toast.error(message);
    },
  });

  const closeAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCredentials(null);
      setCopied(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      {trigger !== null && (
        <DialogTrigger asChild>{trigger ?? <Button>{t("invite")}</Button>}</DialogTrigger>
      )}
      <DialogContent>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("userInvited")}</DialogTitle>
              <DialogDescription>{t("shareTemporaryCredentials")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border bg-muted p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("username")}</p>
                <code className="break-all">{credentials.email}</code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("temporaryPassword")}</p>
                <code className="break-all">{credentials.temporaryPassword}</code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("setPasswordLink")}</p>
                <code className="break-all">{credentials.setPasswordUrl}</code>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${t("username")}: ${credentials.email}\n${t("temporaryPassword")}: ${credentials.temporaryPassword}\n${t("setPasswordLink")}: ${credentials.setPasswordUrl}`,
                  );
                  setCopied(true);
                  toast.success(t("copied"));
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {t("copyCredentials")}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => closeAndReset(false)}>
                {t("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("inviteTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("firstName")}</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("lastName")}</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("roles")}</Label>
            {lockedRoleName ? (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                {lockedRoleName}
              </p>
            ) : (
            <Controller
              name="roleIds"
              control={control}
              render={({ field }) => (
                <div className="space-y-1 rounded-md border p-3">
                  {roles?.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={field.value.includes(role.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked === true
                              ? [...field.value, role.id]
                              : field.value.filter((id) => id !== role.id),
                          )
                        }
                      />
                      <Label htmlFor={`role-${role.id}`} className="font-normal">
                        {role.name}
                      </Label>
                    </div>
                  ))}
                  {!roles?.length && (
                    <p className="text-sm text-muted-foreground">{t("loadingRoles")}</p>
                  )}
                </div>
              )}
            />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? t("inviting") : t("sendInvite")}
            </Button>
          </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
