"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listWebhookDeliveries } from "./api";

const STATUS_VARIANT = {
  SUCCESS: "secondary",
  FAILED: "destructive",
  PENDING: "outline",
} as const;

export function WebhookDeliveriesDialog({
  webhookId,
  open,
  onOpenChange,
}: {
  webhookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", webhookId, "deliveries"],
    queryFn: () => listWebhookDeliveries(webhookId!),
    enabled: open && !!webhookId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recent deliveries</DialogTitle>
          <DialogDescription>Last 50 delivery attempts for this webhook.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          {!isLoading && data?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No deliveries yet.</p>
          )}
          {data?.map((delivery) => (
            <div key={delivery.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <code className="font-medium">{delivery.event}</code>
                <Badge variant={STATUS_VARIANT[delivery.status]}>{delivery.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Attempt {delivery.attempt} · {delivery.responseStatus ?? "no response"} ·{" "}
                {new Date(delivery.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
