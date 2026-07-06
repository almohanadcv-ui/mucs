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

export function TemplatesClient() {
  const { data, isLoading } = useTemplates({ page: 1 });
  const del = useDeleteTemplate();
  const [toDelete, setToDelete] = useState<TemplateRow | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("تم حذف النموذج");
      setToDelete(null);
    } catch {
      toast.error("تعذّر الحذف");
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="size-6 text-primary" /> نماذج التقييم
          </h1>
          <p className="text-sm text-muted-foreground">{data?.meta.total ?? 0} نموذج</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/templates/new">
            <Plus className="size-4" /> نموذج جديد
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">لا توجد نماذج بعد.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{t.title}</h3>
                  <Badge variant={t.isActive ? "success" : "muted"}>
                    {t.isActive ? "مفعّل" : "معطّل"}
                  </Badge>
                </div>
                {t.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                )}
                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListChecks className="size-3.5" /> {t._count?.questions ?? 0} سؤال
                  </span>
                  <span>{t._count?.evaluations ?? 0} تقييم</span>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/templates/${t.id}`}>
                      <Pencil className="size-4" /> تعديل
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(t)}>
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
            <DialogTitle>حذف النموذج</DialogTitle>
            <DialogDescription>حذف «{toDelete?.title}»؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="size-4 animate-spin" />} تأكيد
            </Button>
            <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
