"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBranch, deleteBranch, listBranches } from "@/features/branches/api";
import { createDepartment, deleteDepartment, listDepartments } from "@/features/departments/api";

function toastError(error: unknown) {
  toast.error(
    isAxiosError(error)
      ? ((error.response?.data as { message?: string })?.message ?? "تعذّر الحفظ")
      : "تعذّر الحفظ",
  );
}

export default function OrganizationPage() {
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: listDepartments });

  const [bName, setBName] = useState("");
  const [bCode, setBCode] = useState("");
  const [bCity, setBCity] = useState("");
  const addBranch = useMutation({
    mutationFn: () =>
      createBranch({ name: bName.trim(), code: bCode.trim(), city: bCity.trim() || undefined }),
    onSuccess: () => {
      toast.success("تم إضافة الفرع");
      setBName("");
      setBCode("");
      setBCity("");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: toastError,
  });
  const removeBranch = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => {
      toast.success("تم حذف الفرع");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: toastError,
  });

  const [dName, setDName] = useState("");
  const [dBranch, setDBranch] = useState("");
  const addDept = useMutation({
    mutationFn: () => createDepartment({ name: dName.trim(), branchId: dBranch }),
    onSuccess: () => {
      toast.success("تم إضافة القسم");
      setDName("");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: toastError,
  });
  const removeDept = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      toast.success("تم حذف القسم");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: toastError,
  });

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Building2 className="size-6 text-primary" /> الهيكل التنظيمي
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branches */}
        <Card>
          <CardHeader>
            <CardTitle>الفروع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={bName} onChange={(e) => setBName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>الرمز</Label>
                <Input dir="ltr" value={bCode} onChange={(e) => setBCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>المدينة</Label>
                <Input value={bCity} onChange={(e) => setBCity(e.target.value)} />
              </div>
            </div>
            <Button
              size="sm"
              disabled={!bName.trim() || !bCode.trim() || addBranch.isPending}
              onClick={() => addBranch.mutate()}
            >
              {addBranch.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              إضافة فرع
            </Button>
            <div className="divide-y rounded-lg border">
              {(branches ?? []).map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-medium">{b.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {b.code}
                    </span>
                    <button
                      type="button"
                      title="حذف الفرع"
                      disabled={removeBranch.isPending}
                      onClick={() => {
                        if (confirm(`حذف الفرع "${b.name}"؟`)) removeBranch.mutate(b.id);
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(!branches || branches.length === 0) && (
                <p className="p-3 text-center text-sm text-muted-foreground">لا توجد فروع.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card>
          <CardHeader>
            <CardTitle>الأقسام</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={dName} onChange={(e) => setDName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>الفرع</Label>
                <Select value={dBranch} onValueChange={setDBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!dName.trim() || !dBranch || addDept.isPending}
              onClick={() => addDept.mutate()}
            >
              {addDept.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              إضافة قسم
            </Button>
            <div className="divide-y rounded-lg border">
              {(departments ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{d.branch?.name ?? "—"}</span>
                    <button
                      type="button"
                      title="حذف القسم"
                      disabled={removeDept.isPending}
                      onClick={() => {
                        if (confirm(`حذف القسم "${d.name}"؟`)) removeDept.mutate(d.id);
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(!departments || departments.length === 0) && (
                <p className="p-3 text-center text-sm text-muted-foreground">لا توجد أقسام.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
