"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePasswordRequest } from "@/features/auth/api";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePasswordRequest(current, next),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e) =>
      toast.error(
        isAxiosError(e)
          ? ((e.response?.data as { message?: string })?.message ?? "تعذّر تغيير كلمة المرور")
          : "تعذّر تغيير كلمة المرور",
      ),
  });

  const submit = () => {
    if (next.length < 8) return toast.error("كلمة المرور الجديدة يجب ألا تقل عن ٨ أحرف");
    if (next !== confirm) return toast.error("تأكيد كلمة المرور غير مطابق");
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-md space-y-6" dir="rtl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <KeyRound className="size-6 text-primary" /> تغيير كلمة المرور
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>كلمة مرور جديدة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="current">كلمة المرور الحالية</Label>
            <Input id="current" type="password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="next">كلمة المرور الجديدة</Label>
            <Input id="next" type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
            <Input id="confirm" type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />} حفظ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
