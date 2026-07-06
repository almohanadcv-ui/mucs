"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Check, Copy } from "lucide-react";
import { createApiKeySchema, type CreateApiKeyInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listPermissionGroups } from "@/features/roles/api";
import { createApiKey, type CreatedApiKey } from "./api";

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: groups } = useQuery({ queryKey: ["permission-groups"], queryFn: listPermissionGroups });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateApiKeyInput>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { scopes: [] },
  });

  const mutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setIssuedKey(created);
      reset({ scopes: [] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to create API key"
        : "Failed to create API key";
      toast.error(message);
    },
  });

  const closeAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setIssuedKey(null);
      setCopied(false);
      reset({ scopes: [] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogTrigger asChild>
        <Button variant="outline">New API key</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {issuedKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now — it will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted p-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm">
                {issuedKey.rawKey}
              </code>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(issuedKey.rawKey);
                  setCopied(true);
                  toast.success("Copied to clipboard");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => closeAndReset(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Issue a new API key</DialogTitle>
              <DialogDescription>
                Grant a machine client scoped access via the <code>x-api-key</code> header.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="e.g. CI integration" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <Controller
                  name="scopes"
                  control={control}
                  render={({ field }) => (
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                      {groups?.map((group) => (
                        <div key={group.resource} className="space-y-1">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            {group.resource}
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {group.permissions.map((permission) => {
                              const checked = field.value?.includes(permission.key) ?? false;
                              return (
                                <label
                                  key={permission.key}
                                  className="flex items-center gap-2 text-sm font-normal"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => {
                                      const current = field.value ?? [];
                                      field.onChange(
                                        value === true
                                          ? [...current, permission.key]
                                          : current.filter((k) => k !== permission.key),
                                      );
                                    }}
                                  />
                                  {permission.action}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {errors.scopes && (
                  <p className="text-sm text-destructive">Select at least one scope</p>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                  {mutation.isPending ? "Issuing…" : "Issue key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
