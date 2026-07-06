"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Check, Copy } from "lucide-react";
import { WEBHOOK_EVENTS, createWebhookSchema, type CreateWebhookInput } from "@mica-mab/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createWebhook, type CreatedWebhook } from "./api";

export function CreateWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWebhookInput>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: { events: [], isActive: true },
  });

  const mutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setCreated(webhook);
      reset({ events: [], isActive: true });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to create webhook"
        : "Failed to create webhook";
      toast.error(message);
    },
  });

  const closeAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setCopied(false);
      reset({ events: [], isActive: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogTrigger asChild>
        <Button variant="outline">New webhook</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Webhook created</DialogTitle>
              <DialogDescription>
                Copy this signing secret now — it will not be shown again. Verify deliveries by
                comparing the <code>X-MICA-Signature</code> header (HMAC-SHA256 of the raw body).
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted p-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm">
                {created.secret}
              </code>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(created.secret);
                  setCopied(true);
                  toast.success("Copied to clipboard");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => closeAndReset(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Register a webhook</DialogTitle>
              <DialogDescription>
                We&apos;ll POST a signed JSON payload to this URL whenever a subscribed event fires.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input id="url" placeholder="https://example.com/webhooks/mica-mab" {...register("url")} />
                {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Events</Label>
                <Controller
                  name="events"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1 rounded-md border p-3">
                      {WEBHOOK_EVENTS.map((event) => {
                        const checked = field.value?.includes(event) ?? false;
                        return (
                          <label key={event} className="flex items-center gap-2 text-sm font-normal">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const current = field.value ?? [];
                                field.onChange(
                                  value === true
                                    ? [...current, event]
                                    : current.filter((e) => e !== event),
                                );
                              }}
                            />
                            <code>{event}</code>
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
                {errors.events && (
                  <p className="text-sm text-destructive">Select at least one event</p>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                  {mutation.isPending ? "Registering…" : "Register webhook"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
