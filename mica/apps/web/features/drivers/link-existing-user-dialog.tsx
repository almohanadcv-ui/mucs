"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listUsers } from "@/features/users/api";
import { listDrivers, updateDriver, type DriverListItem } from "./api";

export function LinkExistingUserDialog({
  driver,
  open,
  onOpenChange,
}: {
  driver: DriverListItem | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");

  const { data: users } = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => listUsers({ pageSize: 100 }),
    enabled: open,
  });
  const { data: driversData } = useQuery({
    queryKey: ["drivers", "for-link"],
    queryFn: () => listDrivers({ pageSize: 100 }),
    enabled: open,
  });

  const linkedUserIds = new Set(
    (driversData?.items ?? []).map((d) => d.userId).filter((id): id is string => !!id),
  );
  const linkableUsers = (users?.items ?? []).filter(
    (u) => u.roles.some((r) => r.role.name === "Driver") && !linkedUserIds.has(u.id),
  );

  const mutation = useMutation({
    mutationFn: () => updateDriver(driver!.id, { userId }),
    onSuccess: () => {
      toast.success("تم ربط السائق بالحساب");
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      onOpenChange(false);
      setUserId("");
    },
    onError: (error) => {
      toast.error(
        isAxiosError(error)
          ? ((error.response?.data as { message?: string })?.message ?? "تعذّر الربط")
          : "تعذّر الربط",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            ربط {driver ? `${driver.firstName} ${driver.lastName}` : "السائق"} بحساب موجود
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>حساب المستخدم</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر حساب مستخدم بدور «سائق»" />
            </SelectTrigger>
            <SelectContent>
              {linkableUsers.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  لا يوجد مستخدمون بدور «سائق» غير مرتبطين
                </div>
              )}
              {linkableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            بعد الربط تصل طلبات التصوير لهذا السائق على حساب المستخدم المختار.
          </p>
        </div>
        <DialogFooter>
          <Button disabled={!userId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "جارٍ الربط…" : "ربط"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
