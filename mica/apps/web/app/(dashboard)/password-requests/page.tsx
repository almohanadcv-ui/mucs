"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, MessageCircle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listResetRequests,
  handleResetRequest,
  whatsappLink,
  type ResetRequestItem,
} from "@/features/password-requests/api";

export default function PasswordRequestsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["reset-requests"],
    queryFn: listResetRequests,
  });

  const handle = useMutation({
    mutationFn: handleResetRequest,
    onSuccess: (res, id) => {
      const msg = `مرحبًا ${res.name}، كلمة المرور المؤقتة لحسابك في نظام MICA MAB هي: ${res.tempPassword}\nيمكنك تغييرها بعد تسجيل الدخول من الإعدادات.`;
      const wa = whatsappLink(res.phone, msg);
      // Copy the password as a fallback, then open WhatsApp to the user's number.
      navigator.clipboard?.writeText(res.tempPassword).catch(() => {});
      if (wa) {
        window.open(wa, "_blank");
        toast.success(`كلمة المرور: ${res.tempPassword} — تم فتح واتساب`);
      } else {
        toast.success(`كلمة المرور المؤقتة: ${res.tempPassword} (تم نسخها)`, {
          description: "لا يوجد رقم جوال لهذا المستخدم — أرسلها يدويًا.",
          duration: 15000,
        });
      }
      queryClient.setQueryData<ResetRequestItem[]>(["reset-requests"], (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
    },
    onError: () => toast.error("تعذّرت معالجة الطلب"),
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <KeyRound className="size-6 text-primary" /> طلبات استعادة كلمة المرور
        </h1>
        <p className="text-sm text-muted-foreground">
          اضغط «إرسال عبر واتساب» ليُفتح واتساب على رقم المستخدم مع رابط الاستعادة.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            لا توجد طلبات استعادة حالية.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data!.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {r.user.firstName} {r.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.user.email}
                    {r.user.phone ? (
                      <>
                        <span className="mx-1">·</span>
                        <span dir="ltr">{r.user.phone}</span>
                      </>
                    ) : (
                      <span className="text-destructive"> · لا يوجد رقم جوال</span>
                    )}
                    <span className="mx-1">·</span>
                    {new Date(r.createdAt).toLocaleString("ar-SA")}
                  </p>
                </div>
                <Button
                  onClick={() => handle.mutate(r.id)}
                  disabled={handle.isPending}
                  className="gap-1 bg-green-600 hover:bg-green-700"
                >
                  {handle.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : r.user.phone ? (
                    <MessageCircle className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {r.user.phone ? "إرسال عبر واتساب" : "إنشاء رابط ونسخه"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
