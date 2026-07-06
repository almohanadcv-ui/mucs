"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useLookups,
  type EmployeeRow,
} from "./use-employees";

interface FormValues {
  employeeNo: string;
  name: string;
  status: string;
  joinedAt: string;
  branchId: string;
  departmentId: string;
  supervisorId: string;
  evaluatorId: string;
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "نشط" },
  { value: "INACTIVE", label: "غير نشط" },
  { value: "ON_LEAVE", label: "في إجازة" },
  { value: "TERMINATED", label: "منتهي" },
];

const NONE = "__none__";

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: EmployeeRow | null;
}) {
  const isEdit = !!employee;
  const { data: lookups } = useLookups();
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? "");
  const pending = create.isPending || update.isPending;

  const { register, handleSubmit, setValue, watch, reset, formState } =
    useForm<FormValues>({
      defaultValues: {
        employeeNo: employee?.employeeNo ?? "",
        name: employee?.name ?? "",
        status: employee?.status ?? "ACTIVE",
        joinedAt: employee?.joinedAt ? employee.joinedAt.slice(0, 10) : "",
        branchId: employee?.branchId ?? NONE,
        departmentId: employee?.departmentId ?? NONE,
        supervisorId: employee?.supervisorId ?? NONE,
        evaluatorId: employee?.evaluatorId ?? NONE,
      },
    });

  const [selects] = useState({
    status: employee?.status ?? "ACTIVE",
  });

  async function onSubmit(v: FormValues) {
    const clean = (x: string) => (x === NONE || x === "" ? null : x);
    const payload: Record<string, unknown> = {
      employeeNo: v.employeeNo,
      name: v.name,
      status: v.status,
      joinedAt: v.joinedAt ? new Date(v.joinedAt).toISOString() : null,
      branchId: clean(v.branchId),
      departmentId: clean(v.departmentId),
      supervisorId: clean(v.supervisorId),
      evaluatorId: clean(v.evaluatorId),
    };
    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        toast.success("تم تحديث الموظف");
      } else {
        await create.mutateAsync(payload);
        toast.success("تمت إضافة الموظف");
        reset();
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  const branchId = watch("branchId");
  const departments =
    lookups?.departments.filter(
      (d) => branchId === NONE || !d.branchId || d.branchId === branchId,
    ) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل موظف" : "إضافة موظف"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الرقم الوظيفي</Label>
            <Input dir="ltr" {...register("employeeNo", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input {...register("name", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select
              defaultValue={selects.status}
              onValueChange={(v) => setValue("status", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>تاريخ الانضمام</Label>
            <Input type="date" dir="ltr" {...register("joinedAt")} />
          </div>

          <div className="space-y-2">
            <Label>الفرع</Label>
            <Select
              defaultValue={employee?.branchId ?? NONE}
              onValueChange={(v) => { setValue("branchId", v); setValue("departmentId", NONE); }}
            >
              <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>القسم</Label>
            <Select
              value={watch("departmentId")}
              onValueChange={(v) => setValue("departmentId", v)}
            >
              <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المشرف</Label>
            <Select
              defaultValue={employee?.supervisorId ?? NONE}
              onValueChange={(v) => setValue("supervisorId", v)}
            >
              <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المقيّم</Label>
            <Select
              defaultValue={employee?.evaluatorId ?? NONE}
              onValueChange={(v) => setValue("evaluatorId", v)}
            >
              <SelectTrigger><SelectValue placeholder="اختر المقيّم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.evaluators.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending || formState.isSubmitting}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
