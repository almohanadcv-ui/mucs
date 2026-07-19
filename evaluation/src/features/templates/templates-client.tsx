"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, FileText, Pencil, Trash2, Loader2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useTemplates, useDeleteTemplate, type TemplateRow } from "./use-templates";
import { useT } from "@/i18n/client";

export function TemplatesClient() {
  const t = useT();
  const { data, isLoading } = useTemplates({ page: 1 });
  const del = useDeleteTemplate();
  const [toDelete, setToDelete] = useState<TemplateRow | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(t("templates.deleted"));
      setToDelete(null);
    } catch {
      toast.error(t("templates.deleteFailed"));
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="size-6 text-primary" /> {t("templates.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("templates.count", { n: data?.meta.total ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/templates/new">
            <Plus className="size-4" /> {t("templates.new")}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("templates.none")}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{tpl.title}</h3>
                  <Badge variant={tpl.isActive ? "success" : "muted"}>
                    {tpl.isActive ? t("templates.active") : t("templates.inactive")}
                  </Badge>
                </div>
                {tpl.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{tpl.description}</p>
                )}
                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListChecks className="size-3.5" /> {t("templates.questionsCount", { n: tpl._count?.questions ?? 0 })}
                  </span>
                  <span>{t("templates.evaluationsCount", { n: tpl._count?.evaluations ?? 0 })}</span>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/templates/${tpl.id}`}>
                      <Pencil className="size-4" /> {t("templates.edit")}
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(tpl)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("templates.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("templates.deleteConfirm", { title: toDelete?.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="size-4 animate-spin" />} {t("templates.confirm")}
            </Button>
            <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
