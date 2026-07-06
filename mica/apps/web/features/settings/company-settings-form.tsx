"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { companySettingsSchema, type CompanySettingsInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanySettings, updateCompanySettings } from "@/features/settings/api";
import { usePermission } from "@/lib/auth/use-permission";

export function CompanySettingsForm() {
  const canUpdate = usePermission("settings:update");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings", "company"], queryFn: getCompanySettings });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    values: data,
  });

  const mutation = useMutation({
    mutationFn: updateCompanySettings,
    onSuccess: (saved) => {
      toast.success("Company settings saved");
      queryClient.setQueryData(["settings", "company"], saved);
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
          <CardTitle>Company profile</CardTitle>
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
        <CardTitle>Company profile</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" disabled={!canUpdate} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" disabled={!canUpdate} {...register("legalName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID</Label>
            <Input id="taxId" disabled={!canUpdate} {...register("taxId")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" disabled={!canUpdate} {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" disabled={!canUpdate} {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" disabled={!canUpdate} {...register("website")} />
            {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency (ISO 4217)</Label>
            <Input id="currency" maxLength={3} disabled={!canUpdate} {...register("currency")} />
            {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" disabled={!canUpdate} {...register("timezone")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" disabled={!canUpdate} {...register("address")} />
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
