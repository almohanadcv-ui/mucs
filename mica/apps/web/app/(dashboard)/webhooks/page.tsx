"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { CreateWebhookDialog } from "@/features/webhooks/create-webhook-dialog";
import { WebhookDeliveriesDialog } from "@/features/webhooks/webhook-deliveries-dialog";
import { deleteWebhook, listWebhooks, testWebhook, updateWebhook } from "@/features/webhooks/api";

export default function WebhooksPage() {
  const canCreate = usePermission("webhooks:create");
  const canUpdate = usePermission("webhooks:update");
  const canDelete = usePermission("webhooks:delete");
  const canTest = usePermission("webhooks:test");
  const queryClient = useQueryClient();
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["webhooks"], queryFn: listWebhooks });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateWebhook(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
    onError: () => toast.error("Failed to update webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      toast.success("Webhook deleted");
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: () => toast.error("Failed to delete webhook"),
  });

  const testMutation = useMutation({
    mutationFn: testWebhook,
    onSuccess: () => toast.success("Test delivery queued"),
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to send test delivery"
        : "Failed to send test delivery";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            HMAC-signed event delivery to external endpoints.
          </p>
        </div>
        {canCreate && <CreateWebhookDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Last triggered</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No webhooks registered yet.
                </TableCell>
              </TableRow>
            )}

            {data?.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell className="max-w-64 truncate font-medium">{webhook.url}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.slice(0, 2).map((event) => (
                      <Badge key={event} variant="outline">
                        {event}
                      </Badge>
                    ))}
                    {webhook.events.length > 2 && (
                      <Badge variant="outline">+{webhook.events.length - 2}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={webhook.isActive}
                    disabled={!canUpdate || toggleMutation.isPending}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: webhook.id, isActive: checked })
                    }
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).toLocaleString() : "Never"}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDeliveriesFor(webhook.id)}>
                      Deliveries
                    </Button>
                    {canTest && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(webhook.id)}
                      >
                        Test
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(webhook.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <WebhookDeliveriesDialog
        webhookId={deliveriesFor}
        open={deliveriesFor !== null}
        onOpenChange={(open) => !open && setDeliveriesFor(null)}
      />
    </div>
  );
}
