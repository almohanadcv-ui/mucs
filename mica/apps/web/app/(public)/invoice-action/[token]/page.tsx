"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Check, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSAR } from "@/lib/currency";
import {
  decideInvoiceAction,
  getInvoiceAction,
  type ActionState,
} from "@/features/invoices/action-api";

/** One sentence per reason the page cannot offer a decision. */
const BLOCKED: Record<Exclude<ActionState, "actionable">, string> = {
  decided: "سبق البتّ في هذه الفاتورة.",
  expired: "انتهت صلاحية هذا الرابط. افتح الفاتورة من قائمة الفواتير.",
  used: "استُخدم هذا الرابط من قبل.",
  unknown: "هذا الرابط غير صالح.",
};

/**
 * Confirmation page for an approval link sent by email.
 *
 * Opening it decides nothing — it reads the invoice and waits. The decision is
 * a POST the manager makes deliberately, which is what keeps mail scanners and
 * link previews from approving payments on their own.
 *
 * Living under (dashboard) means the existing auth guard applies: an
 * unauthenticated visitor is sent to log in and returned here afterwards.
 */
export default function InvoiceActionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  // The email's Approve/Reject buttons differ only in what opens preselected.
  const intent = searchParams.get("intent");

  const [mode, setMode] = useState<"approve" | "reject" | null>(
    intent === "approve" || intent === "reject" ? intent : null,
  );
  const [reason, setReason] = useState("");
  // The whole journey ends here: there is no session to carry anyone into the
  // app, so the outcome has to be stated on this page.
  const [done, setDone] = useState<"approve" | "reject" | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["invoice-action", token],
    queryFn: () => getInvoiceAction(token),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (body: { decision: "approve" | "reject"; rejectionReason?: string }) =>
      decideInvoiceAction(token, body),
    onSuccess: (_, body) => {
      toast.success(body.decision === "approve" ? "تم اعتماد الفاتورة" : "تم رفض الفاتورة");
      setDone(body.decision);
    },
    onError: (error) => {
      // The server's message is shown as-is: it distinguishes "already decided"
      // from "link expired", and inventing a generic line here would hide which.
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر تنفيذ القرار")
        : "تعذّر تنفيذ القرار";
      toast.error(message);
      refetch();
    },
  });

  if (done) {
    const approved = done === "approve";
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          {approved ? (
            <Check className="size-10 text-emerald-600" />
          ) : (
            <X className="size-10 text-destructive" />
          )}
          <p className="text-lg font-medium">
            {approved ? "تم اعتماد الفاتورة" : "تم رفض الفاتورة"}
          </p>
          <p className="text-sm text-muted-foreground">
            سُجّل قرارك، وأُرسل إشعار إلى من رفع الفاتورة. يمكنك إغلاق هذه الصفحة.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!data || data.state !== "actionable") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="size-9 text-muted-foreground" />
            <p className="text-lg font-medium">
              {BLOCKED[(data?.state ?? "unknown") as keyof typeof BLOCKED]}
            </p>
            {data?.invoice && (
              <p className="text-sm text-muted-foreground">
                الفاتورة {data.invoice.invoiceNumber} — الحالة الحالية:{" "}
                {data.invoice.status === "ACCEPTED" ? "معتمدة" : "مرفوضة"}
              </p>
            )}

          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = data.invoice!;
  const rows: [string, string][] = [
    ["رقم الفاتورة", invoice.invoiceNumber],
    ["المركبة", invoice.vehicle?.plateNumber ?? "—"],
    ["المبلغ", formatSAR(Number(invoice.amount))],
    ["الورشة", invoice.workshopName ?? "—"],
    ["رفعها", invoice.submittedBy ?? "—"],
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">مراجعة الفاتورة</h1>
        <p className="text-muted-foreground">
          راجع البيانات ثم اعتمد أو ارفض. لن يُنفَّذ أي شيء حتى تؤكّد.
        </p>
      </div>

      {data.addressedToSomeoneElse && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          هذا الرابط أُرسل إلى زميل آخر. قرارك سيُسجَّل باسمك أنت.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{invoice.invoiceNumber}</CardTitle>
          <Badge variant="secondary">بانتظار الاعتماد</Badge>
        </CardHeader>
        <CardContent className="divide-y">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {mode === "reject" && (
        <div className="space-y-2">
          <Label>سبب الرفض</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اكتب سببًا يوضّح للميكانيكي ما يجب تصحيحه"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={mutation.isPending}
          onClick={() => {
            if (mode !== "approve") return setMode("approve");
            mutation.mutate({ decision: "approve" });
          }}
        >
          {mutation.isPending && mode === "approve" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {mode === "approve" ? "تأكيد الاعتماد" : "اعتماد"}
        </Button>

        <Button
          variant="destructive"
          disabled={mutation.isPending}
          onClick={() => {
            if (mode !== "reject") return setMode("reject");
            if (reason.trim().length < 3) {
              toast.error("اكتب سبب الرفض أولًا");
              return;
            }
            mutation.mutate({ decision: "reject", rejectionReason: reason.trim() });
          }}
        >
          {mutation.isPending && mode === "reject" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          {mode === "reject" ? "تأكيد الرفض" : "رفض"}
        </Button>

        {mode && (
          <Button variant="ghost" disabled={mutation.isPending} onClick={() => setMode(null)}>
            إلغاء
          </Button>
        )}
      </div>
    </div>
  );
}
