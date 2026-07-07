"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPhotoRequest } from "./api";

/** Mechanic/Manager button on the vehicle page: ask the driver to photograph the meters. */
export function RequestPhotosButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("يرجى تصوير العدادات (الوقود + الكيلومترات)");

  const mutation = useMutation({
    mutationFn: () => createPhotoRequest(vehicleId, message.trim() || "يرجى تصوير العدادات"),
    onSuccess: () => {
      toast.success("تم إرسال الطلب إلى السائق");
      setOpen(false);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? ((error.response?.data as { message?: string })?.message ?? "تعذّر إرسال الطلب")
        : "تعذّر إرسال الطلب";
      toast.error(message);
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Camera className="size-4" /> اطلب تصوير من السائق
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلب تصوير العدادات</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>الرسالة للسائق</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />} إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
