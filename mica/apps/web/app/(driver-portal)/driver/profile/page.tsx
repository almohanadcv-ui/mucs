"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth/session-context";
import { updateOwnProfileRequest } from "@/features/auth/api";

export default function DriverProfilePage() {
  const t = useTranslations("driverPortal.profile");
  const tc = useTranslations("common");
  const { user } = useSession();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: "",
    },
  });

  const mutation = useMutation({
    mutationFn: updateOwnProfileRequest,
    onSuccess: (updated) => {
      queryClient.setQueryData(["auth", "me"], updated);
      toast.success(t("savedToast"));
    },
    onError: () => toast.error(t("saveFailed")),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <CardContent className="space-y-4">
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
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" {...register("phone")} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? tc("saving") : tc("saveChanges")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
