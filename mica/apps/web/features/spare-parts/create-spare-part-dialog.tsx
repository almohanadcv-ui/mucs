"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { createSparePartSchema, type CreateSparePartInput } from "@mica-mab/shared-types";
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
import { createSparePart } from "./api";

export function CreateSparePartDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("spareParts");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches, enabled: open });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSparePartInput>({
    resolver: zodResolver(createSparePartSchema),
    defaultValues: { quantityOnHand: 0, reorderThreshold: 0 },
  });

  const mutation = useMutation({
    mutationFn: createSparePart,
    onSuccess: () => {
      toast.success(t("createdToast"));
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
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
              <Label htmlFor="sku">{t("sku")}</Label>
              <Input id="sku" {...register("sku")} />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitCost">{t("unitCost")}</Label>
              <Input id="unitCost" type="number" step="0.01" {...register("unitCost")} />
              {errors.unitCost && (
                <p className="text-sm text-destructive">{errors.unitCost.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantityOnHand">{t("quantity")}</Label>
              <Input id="quantityOnHand" type="number" {...register("quantityOnHand")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderThreshold">{t("reorderThreshold")}</Label>
              <Input id="reorderThreshold" type="number" {...register("reorderThreshold")} />
            </div>
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
