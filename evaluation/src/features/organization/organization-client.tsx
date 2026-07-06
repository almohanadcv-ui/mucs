"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Layers, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useBranches,
  useDepartments,
  useSaveBranch,
  useSaveDepartment,
  useDeleteBranch,
  useDeleteDepartment,
  type BranchRow,
  type DepartmentRow,
} from "./use-org";

const NONE = "__none__";

export function OrganizationClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Building2 className="size-6 text-primary" /> الهيكل التنظيمي
        </h1>
        <p className="text-sm text-muted-foreground">إدارة الفروع والأقسام</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <BranchesSection />
        <DepartmentsSection />
      </div>
    </div>
  );
}

/* ------------------------- Branches ------------------------- */
function BranchesSection() {
  const { data, isLoading } = useBranches();
  const save = useSaveBranch();
  const del = useDeleteBranch();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  function openNew() {
    setEditing(null);
    setForm({ name: "", code: "", address: "" });
    setOpen(true);
  }
  function openEdit(b: BranchRow) {
    setEditing(b);
    setForm({ name: b.name, code: b.code, address: b.address ?? "" });
    setOpen(true);
  }
  async function submit() {
    if (!form.name.trim() || !form.code.trim()) return toast.error("الاسم والرمز مطلوبان");
    try {
      await save.mutateAsync({ id: editing?.id, name: form.name, code: form.code, address: form.address || null });
      toast.success("تم الحفظ");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  const rows = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Building2 className="size-5" /> الفروع</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> فرع</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد فروع.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{b.name} <Badge variant="muted">{b.code}</Badge></p>
                  <p className="text-xs text-muted-foreground">
                    {b._count?.departments ?? 0} قسم · {b._count?.employees ?? 0} موظف
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => del.mutate(b.id, { onSuccess: () => toast.success("تم الحذف") })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل فرع" : "فرع جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>الرمز</Label>
              <Input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MAIN" /></div>
            <div className="space-y-1"><Label>العنوان (اختياري)</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} حفظ
            </Button>
            <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------- Departments ------------------------- */
function DepartmentsSection() {
  const { data, isLoading } = useDepartments();
  const { data: branches } = useBranches();
  const save = useSaveDepartment();
  const del = useDeleteDepartment();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [form, setForm] = useState({ name: "", code: "", branchId: NONE });

  function openNew() {
    setEditing(null);
    setForm({ name: "", code: "", branchId: NONE });
    setOpen(true);
  }
  function openEdit(d: DepartmentRow) {
    setEditing(d);
    setForm({ name: d.name, code: d.code, branchId: d.branchId ?? NONE });
    setOpen(true);
  }
  async function submit() {
    if (!form.name.trim() || !form.code.trim()) return toast.error("الاسم والرمز مطلوبان");
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: form.name,
        code: form.code,
        branchId: form.branchId === NONE ? null : form.branchId,
      });
      toast.success("تم الحفظ");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  const rows = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Layers className="size-5" /> الأقسام</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> قسم</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أقسام.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{d.name} <Badge variant="muted">{d.code}</Badge></p>
                  <p className="text-xs text-muted-foreground">
                    {d.branch?.name ?? "بدون فرع"} · {d._count?.employees ?? 0} موظف
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => del.mutate(d.id, { onSuccess: () => toast.success("تم الحذف") })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل قسم" : "قسم جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>الرمز</Label>
              <Input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SEC" /></div>
            <div className="space-y-1"><Label>الفرع</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>بدون فرع</SelectItem>
                  {(branches?.items ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} حفظ
            </Button>
            <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
