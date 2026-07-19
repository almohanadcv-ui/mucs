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
import { useT } from "@/i18n/client";

interface FormValues {
  employeeNo: string;
  name: string;
  status: string;
  joinedAt: string;
  contractStartDate: string;
  contractMonths: string; // "12" | "24" | "36" | "48" | NONE
  probationSel: string; // "3" | "6" | "12" | "custom" | NONE
  probationCustom: string; // months as text when probationSel === "custom"
  branchId: string;
  departmentId: string;
  supervisorId: string;
  evaluatorId: string;
  // HR fields
  nameEn: string;
  email: string;
  nationalId: string;
  nationality: string;
  gender: string;
  jobTitle: string;
  directManager: string;
}

const CONTRACT_OPTIONS = [
  { value: "12", label: "empForm.year" },
  { value: "24", label: "empForm.twoYears" },
  { value: "36", label: "empForm.threeYears" },
  { value: "48", label: "empForm.fourYears" },
];
const PROBATION_OPTIONS = [
  { value: "3", label: "empForm.threeMonths" },
  { value: "6", label: "empForm.sixMonths" },
  { value: "12", label: "empForm.year" },
  { value: "custom", label: "empForm.custom" },
];
const PRESET_PROBATION = ["3", "6", "12"];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "empStatus.ACTIVE" },
  { value: "INACTIVE", label: "empStatus.INACTIVE" },
  { value: "ON_LEAVE", label: "empStatus.ON_LEAVE" },
  { value: "TERMINATED", label: "empStatus.TERMINATED" },
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
  const t = useT();
  const isEdit = !!employee;
  const { data: lookups } = useLookups();
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? "");
  const pending = create.isPending || update.isPending;
  const ex = (employee ?? {}) as Record<string, string | null | undefined>;

  const { register, handleSubmit, setValue, watch, reset, formState } =
    useForm<FormValues>({
      defaultValues: {
        employeeNo: employee?.employeeNo ?? "",
        name: employee?.name ?? "",
        status: employee?.status ?? "ACTIVE",
        joinedAt: employee?.joinedAt ? employee.joinedAt.slice(0, 10) : "",
        contractStartDate: employee?.contractStartDate
          ? employee.contractStartDate.slice(0, 10)
          : "",
        contractMonths: employee?.contractMonths ? String(employee.contractMonths) : NONE,
        probationSel: employee?.probationMonths
          ? PRESET_PROBATION.includes(String(employee.probationMonths))
            ? String(employee.probationMonths)
            : "custom"
          : NONE,
        probationCustom:
          employee?.probationMonths && !PRESET_PROBATION.includes(String(employee.probationMonths))
            ? String(employee.probationMonths)
            : "",
        branchId: employee?.branchId ?? NONE,
        departmentId: employee?.departmentId ?? NONE,
        supervisorId: employee?.supervisorId ?? NONE,
        evaluatorId: employee?.evaluatorId ?? NONE,
        nameEn: ex.nameEn ?? "",
        email: ex.email ?? "",
        nationalId: ex.nationalId ?? "",
        nationality: ex.nationality ?? "",
        gender: ex.gender ?? "",
        jobTitle: ex.jobTitle ?? "",
        directManager: ex.directManager ?? "",
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
      contractStartDate: v.contractStartDate
        ? new Date(v.contractStartDate).toISOString()
        : null,
      contractMonths:
        v.contractMonths && v.contractMonths !== NONE ? Number(v.contractMonths) : null,
      probationMonths:
        v.probationSel === "custom"
          ? v.probationCustom
            ? Number(v.probationCustom)
            : null
          : v.probationSel && v.probationSel !== NONE
            ? Number(v.probationSel)
            : null,
      branchId: clean(v.branchId),
      departmentId: clean(v.departmentId),
      supervisorId: clean(v.supervisorId),
      evaluatorId: clean(v.evaluatorId),
      nameEn: v.nameEn?.trim() || null,
      email: v.email?.trim() || null,
      nationalId: v.nationalId?.trim() || null,
      nationality: v.nationality?.trim() || null,
      gender: v.gender?.trim() || null,
      jobTitle: v.jobTitle?.trim() || null,
      directManager: v.directManager?.trim() || null,
    };
    try {
      if (isEdit) {
        await update.mutateAsync(payload);
        toast.success(t("empForm.updated"));
      } else {
        await create.mutateAsync(payload);
        toast.success(t("empForm.added"));
        reset();
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("empForm.saveFailed"));
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
          <DialogTitle>{isEdit ? t("empForm.editTitle") : t("empForm.addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("empForm.employeeNo")}</Label>
            <Input dir="ltr" {...register("employeeNo", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.name")}</Label>
            <Input {...register("name", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label>{t("common.status")}</Label>
            <Select
              defaultValue={selects.status}
              onValueChange={(v) => setValue("status", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.joinedAt")}</Label>
            <Input type="date" dir="ltr" {...register("joinedAt")} />
          </div>

          <div className="space-y-2">
            <Label>{t("empForm.contractStart")}</Label>
            <Input type="date" dir="ltr" {...register("contractStartDate")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.contractDuration")}</Label>
            <Select
              defaultValue={employee?.contractMonths ? String(employee.contractMonths) : NONE}
              onValueChange={(v) => setValue("contractMonths", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.chooseDuration")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {CONTRACT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.probation")}</Label>
            <Select
              defaultValue={
                employee?.probationMonths
                  ? PRESET_PROBATION.includes(String(employee.probationMonths))
                    ? String(employee.probationMonths)
                    : "custom"
                  : NONE
              }
              onValueChange={(v) => setValue("probationSel", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.choosePeriod")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {PROBATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {watch("probationSel") === "custom" && (
            <div className="space-y-2">
              <Label>{t("empForm.probationMonths")}</Label>
              <Input
                type="number"
                min={1}
                max={60}
                dir="ltr"
                placeholder={t("empForm.probationExample")}
                {...register("probationCustom")}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("empForm.branch")}</Label>
            <Select
              defaultValue={employee?.branchId ?? NONE}
              onValueChange={(v) => { setValue("branchId", v); setValue("departmentId", NONE); }}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.chooseBranch")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.department")}</Label>
            <Select
              value={watch("departmentId")}
              onValueChange={(v) => setValue("departmentId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.chooseDepartment")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("empForm.supervisor")}</Label>
            <Select
              defaultValue={employee?.supervisorId ?? NONE}
              onValueChange={(v) => setValue("supervisorId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.chooseSupervisor")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.evaluator")}</Label>
            <Select
              defaultValue={employee?.evaluatorId ?? NONE}
              onValueChange={(v) => setValue("evaluatorId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("empForm.chooseEvaluator")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lookups?.evaluators.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("empForm.nameEn")}</Label>
            <Input dir="ltr" {...register("nameEn")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.email")}</Label>
            <Input dir="ltr" type="email" {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.nationalId")}</Label>
            <Input dir="ltr" {...register("nationalId")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.nationality")}</Label>
            <Input {...register("nationality")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.gender")}</Label>
            <Input {...register("gender")} />
          </div>
          <div className="space-y-2">
            <Label>{t("empForm.jobTitle")}</Label>
            <Input {...register("jobTitle")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("empForm.directManager")}</Label>
            <Input {...register("directManager")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending || formState.isSubmitting}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? t("empForm.saveChanges") : t("empForm.addBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
