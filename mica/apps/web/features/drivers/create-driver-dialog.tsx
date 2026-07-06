"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { createDriverSchema, type CreateDriverInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listBranches } from "@/features/branches/api";
import { createDriver } from "./api";

export function CreateDriverDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("drivers");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches, enabled: open });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDriverInput>({ resolver: zodResolver(createDriverSchema) });

  const mutation = useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      toast.success(t("createdToast"));
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? t("createFailed")
        : t("createFailed");
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeCode">{t("employeeCode")}</Label>
              <Input id="employeeCode" {...register("employeeCode")} />
              {errors.employeeCode && (
                <p className="text-sm text-destructive">{errors.employeeCode.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">{t("licenseNumber")}</Label>
              <Input id="licenseNumber" {...register("licenseNumber")} />
              {errors.licenseNumber && (
                <p className="text-sm text-destructive">{errors.licenseNumber.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>{tc("branch")}</Label>
            <Controller
              name="branchId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={tc("selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.branchId && (
              <p className="text-sm text-destructive">{errors.branchId.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? tc("adding") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
