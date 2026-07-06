"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { smtpSettingsSchema, type SmtpSettingsInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSmtpSettings, testSmtpSettings, updateSmtpSettings } from "@/features/settings/api";
import { usePermission } from "@/lib/auth/use-permission";

export function SmtpSettingsForm() {
  const canUpdate = usePermission("settings:update");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings", "smtp"], queryFn: getSmtpSettings });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SmtpSettingsInput>({
    resolver: zodResolver(smtpSettingsSchema),
    values: data ? { ...data, password: "" } : undefined,
  });

  const mutation = useMutation({
    mutationFn: updateSmtpSettings,
    onSuccess: (saved) => {
      toast.success("SMTP settings saved");
      queryClient.setQueryData(["settings", "smtp"], saved);
      reset({ ...saved, password: "" });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to save settings"
        : "Failed to save settings";
      toast.error(message);
    },
  });

  const testMutation = useMutation({
    mutationFn: testSmtpSettings,
    onSuccess: () => toast.success("Test email sent — check your inbox"),
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to send test email"
        : "Failed to send test email";
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SMTP / email delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP / email delivery</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host">SMTP host</Label>
            <Input id="host" disabled={!canUpdate} {...register("host")} />
            {errors.host && <p className="text-sm text-destructive">{errors.host.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input id="port" type="number" disabled={!canUpdate} {...register("port")} />
            {errors.port && <p className="text-sm text-destructive">{errors.port.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" disabled={!canUpdate} {...register("username")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              Password {data?.hasPassword && <span className="text-muted-foreground">(unchanged if left blank)</span>}
            </Label>
            <Input id="password" type="password" disabled={!canUpdate} {...register("password")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromName">From name</Label>
            <Input id="fromName" disabled={!canUpdate} {...register("fromName")} />
            {errors.fromName && <p className="text-sm text-destructive">{errors.fromName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromAddress">From address</Label>
            <Input id="fromAddress" type="email" disabled={!canUpdate} {...register("fromAddress")} />
            {errors.fromAddress && (
              <p className="text-sm text-destructive">{errors.fromAddress.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Controller
              name="secure"
              control={control}
              render={({ field }) => (
                <Switch
                  id="secure"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canUpdate}
                />
              )}
            />
            <Label htmlFor="secure" className="font-normal">
              Use TLS/SSL (port 465)
            </Label>
          </div>
        </CardContent>
        {canUpdate && (
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending || isDirty}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? "Sending…" : "Send test email"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
