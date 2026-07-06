"use client";

import { Loader2 } from "lucide-react";
import { useTemplate } from "./use-templates";
import { TemplateBuilder } from "./template-builder";

export function TemplateEditLoader({ id }: { id: string }) {
  const { data, isLoading, isError } = useTemplate(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="py-20 text-center text-sm text-destructive">تعذّر تحميل النموذج.</p>;
  }
  return <TemplateBuilder initial={data} />;
}
