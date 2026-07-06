"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CreateApiKeyDialog } from "@/features/api-keys/create-api-key-dialog";
import { listApiKeys, revokeApiKey, type ApiKeyItem } from "@/features/api-keys/api";

function statusBadge(key: ApiKeyItem) {
  if (key.revokedAt) return <Badge variant="destructive">Revoked</Badge>;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  return <Badge variant="secondary">Active</Badge>;
}

export default function ApiKeysPage() {
  const canCreate = usePermission("api-keys:create");
  const canRevoke = usePermission("api-keys:revoke");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      toast.success("API key revoked");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to revoke key"
        : "Failed to revoke key";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="text-muted-foreground">
            Scoped credentials for machine-to-machine access via the <code>x-api-key</code> header.
          </p>
        </div>
        {canCreate && <CreateApiKeyDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No API keys yet.
                </TableCell>
              </TableRow>
            )}

            {data?.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>
                  <code className="text-xs text-muted-foreground">{key.prefix}…</code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.slice(0, 3).map((scope) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                    {key.scopes.length > 3 && (
                      <Badge variant="outline">+{key.scopes.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{statusBadge(key)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                </TableCell>
                <TableCell className="text-end">
                  {canRevoke && !key.revokedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
