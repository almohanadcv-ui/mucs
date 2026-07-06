"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { themeSettingsSchema, type ThemeSettingsInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getThemeSettings, updateThemeSettings } from "@/features/settings/api";
import { usePermission } from "@/lib/auth/use-permission";

export function ThemeSettingsForm() {
  const canUpdate = usePermission("settings:update");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings", "theme"], queryFn: getThemeSettings });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ThemeSettingsInput>({
    resolver: zodResolver(themeSettingsSchema),
    values: data,
  });

  const mutation = useMutation({
    mutationFn: updateThemeSettings,
    onSuccess: (saved) => {
      toast.success("Theme settings saved");
      queryClient.setQueryData(["settings", "theme"], saved);
      reset(saved);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to save settings"
        : "Failed to save settings";
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Branding &amp; defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding &amp; defaults</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary color</Label>
            <Input id="primaryColor" placeholder="#2563eb" disabled={!canUpdate} {...register("primaryColor")} />
            {errors.primaryColor && (
              <p className="text-sm text-destructive">Must be a hex color like #2563eb</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Default theme mode</Label>
            <Controller
              name="defaultMode"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!canUpdate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Default language</Label>
            <Controller
              name="defaultLocale"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!canUpdate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
        {canUpdate && (
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
