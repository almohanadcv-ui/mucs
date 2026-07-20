"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { Plus, Search, Pencil, Trash2, Loader2, Users, FileUp } from "lucide-react";
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
import { CreateManagerDialog } from "./create-manager-dialog";
import {
  useEmployees,
  useDeleteEmployee,
  type EmployeeRow,
} from "./use-employees";
import { useT } from "@/i18n/client";

/**
 * Remaining time until a contract/probation ends, with a color that escalates
 * as the deadline approaches: green (>90d) → amber (30–90d) → red (<30d/ended).
 */
function remaining(
  startISO: string | null,
  months: number | null,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!startISO || !months) return null;
  const end = addMonths(new Date(startISO), months);
  const days = differenceInCalendarDays(end, new Date());
  const color =
    days < 30
      ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
      : days <= 90
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  return { color, text: days < 0 ? t("employees.ended") : t("employees.daysLeft", { n: days }) };
}

function ContractCell({ e }: { e: EmployeeRow }) {
  const t = useT();
  const prob = remaining(e.contractStartDate, e.probationMonths, t);
  const contract = remaining(e.contractStartDate, e.contractMonths, t);
  if (!prob && !contract) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {prob && (
        <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium", prob.color)}>
          {t("employees.probation")}: {prob.text}
        </span>
      )}
      {contract && (
        <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium", contract.color)}>
          {t("employees.contract")}: {contract.text}
        </span>
      )}
    </div>
  );
}

export function EmployeesClient({
  canManage,
  canImport,
  canCreateManager,
  creatableRoles = [],
}: {
  canManage: boolean;
  canImport?: boolean;
  canCreateManager?: boolean;
  /** Roles this user may mint, from CREATABLE_ROLES on the server. */
  creatableRoles?: string[];
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [toDelete, setToDelete] = useState<EmployeeRow | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useEmployees({ page, search });
  const del = useDeleteEmployee();

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/employees/import", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? t("employees.importFailed"));
      const d = body.data ?? body;
      toast.success(
        t("employees.importResult", { created: d.created, updated: d.updated, skipped: d.skippedInactive }),
      );
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("employees.importFailed"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
      toast.success(t("employees.deleted"));
      setToDelete(null);
    } catch {
      toast.error(t("employees.deleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="size-6 text-primary" /> {t("employees.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("employees.count", { n: meta?.total ?? 0 })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateManager && <CreateManagerDialog creatableRoles={creatableRoles} />}
          {canImport && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                }}
              />
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                {t("employees.importExcel")}
              </Button>
            </>
          )}
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("employees.add")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder={t("employees.searchPlaceholder")}
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
            <p className="py-12 text-center text-sm text-destructive">{t("common.loadFailed")}</p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("employees.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("employees.colNo")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.name")}</th>
                    <th className="px-3 py-2 font-medium">{t("employees.colDepartment")}</th>
                    <th className="px-3 py-2 font-medium">{t("employees.colContract")}</th>
                    <th className="px-3 py-2 font-medium">{t("employees.colSupervisor")}</th>
                    <th className="px-3 py-2 font-medium">{t("employees.colEvaluator")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                    {canManage && <th className="px-3 py-2 font-medium">{t("common.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-3 tabular-nums">{e.employeeNo}</td>
                      <td className="px-3 py-3 font-medium">
                        <Link
                          href={`/dashboard/employees/${e.id}`}
                          className="text-primary hover:underline"
                        >
                          {e.name}
                        </Link>
                      </td>
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
                {t("common.pageOf", { page: meta.page, total: meta.totalPages })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
                  {t("common.previous")}
                </Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
                  {t("common.next")}
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
            <DialogTitle>{t("employees.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("employees.deleteConfirm", { name: toDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="size-4 animate-spin" />} {t("employees.confirmDelete")}
            </Button>
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
