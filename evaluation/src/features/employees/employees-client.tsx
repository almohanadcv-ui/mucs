"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { Plus, Search, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { EmployeeStatusBadge } from "@/features/dashboard/status-badges";
import { EmployeeFormDialog } from "./employee-form-dialog";
import {
  useEmployees,
  useDeleteEmployee,
  type EmployeeRow,
} from "./use-employees";

/**
 * Remaining time until a contract/probation ends, with a color that escalates
 * as the deadline approaches: green (>90d) → amber (30–90d) → red (<30d/ended).
 */
function remaining(startISO: string | null, months: number | null) {
  if (!startISO || !months) return null;
  const end = addMonths(new Date(startISO), months);
  const days = differenceInCalendarDays(end, new Date());
  const color =
    days < 30
      ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
      : days <= 90
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  return { color, text: days < 0 ? "منتهٍ" : `${days} يوم` };
}

function ContractCell({ e }: { e: EmployeeRow }) {
  const prob = remaining(e.contractStartDate, e.probationMonths);
  const contract = remaining(e.contractStartDate, e.contractMonths);
  if (!prob && !contract) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {prob && (
        <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium", prob.color)}>
          التجربة: {prob.text}
        </span>
      )}
      {contract && (
        <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium", contract.color)}>
          العقد: {contract.text}
        </span>
      )}
    </div>
  );
}

export function EmployeesClient({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [toDelete, setToDelete] = useState<EmployeeRow | null>(null);

  const { data, isLoading, isError } = useEmployees({ page, search });
  const del = useDeleteEmployee();

  const rows = data?.items ?? [];
  const meta = data?.meta;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(e: EmployeeRow) {
    setEditing(e);
    setFormOpen(true);
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("تم حذف الموظف");
      setToDelete(null);
    } catch {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="size-6 text-primary" /> الموظفون
          </h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total ?? 0} موظف
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> إضافة موظف
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="بحث بالاسم أو الرقم الوظيفي..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-destructive">تعذّر تحميل البيانات.</p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">لا يوجد موظفون.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">الرقم</th>
                    <th className="px-3 py-2 font-medium">الاسم</th>
                    <th className="px-3 py-2 font-medium">القسم</th>
                    <th className="px-3 py-2 font-medium">العقد / التجربة</th>
                    <th className="px-3 py-2 font-medium">المشرف</th>
                    <th className="px-3 py-2 font-medium">المقيّم</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    {canManage && <th className="px-3 py-2 font-medium">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3 tabular-nums">{e.employeeNo}</td>
                      <td className="px-3 py-3 font-medium">{e.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.department?.name ?? "—"}</td>
                      <td className="px-3 py-3"><ContractCell e={e} /></td>
                      <td className="px-3 py-3 text-muted-foreground">{e.supervisor?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.evaluator?.name ?? "—"}</td>
                      <td className="px-3 py-3"><EmployeeStatusBadge status={e.status} /></td>
                      {canManage && (
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setToDelete(e)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                صفحة {meta.page} من {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
                  السابق
                </Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
                  التالي
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <EmployeeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          employee={editing}
        />
      )}

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف الموظف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف «{toDelete?.name}»؟ يمكن التراجع عبر قاعدة البيانات (حذف ناعم).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="size-4 animate-spin" />} تأكيد الحذف
            </Button>
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
