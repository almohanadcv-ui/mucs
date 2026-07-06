"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PermissionScopeValue } from "@mica-mab/shared-types";
import { listPermissionGroups, setRolePermissions, type RoleListItem } from "./api";
import { usePermission } from "@/lib/auth/use-permission";

const SCOPES: PermissionScopeValue[] = ["OWN", "BRANCH", "ALL"];

interface DraftEntry {
  granted: boolean;
  scope: PermissionScopeValue;
}

export function PermissionMatrix({ role }: { role: RoleListItem }) {
  const queryClient = useQueryClient();
  const canAssign = usePermission("roles:assign");
  const { data: groups } = useQuery({
    queryKey: ["permission-groups"],
    queryFn: listPermissionGroups,
  });

  // Callers render this component with `key={role.id}` so switching roles
  // remounts it with fresh initial state, instead of syncing via an effect.
  const [draft, setDraft] = useState<Record<string, DraftEntry>>(() => {
    const initial: Record<string, DraftEntry> = {};
    for (const rp of role.permissions) {
      initial[rp.permission.id] = { granted: true, scope: rp.scope as PermissionScopeValue };
    }
    return initial;
  });

  const mutation = useMutation({
    mutationFn: () =>
      setRolePermissions(role.id, {
        permissions: Object.entries(draft)
          .filter(([, entry]) => entry.granted)
          .map(([permissionId, entry]) => ({ permissionId, scope: entry.scope })),
      }),
    onSuccess: () => {
      toast.success(`Permissions updated for ${role.name}`);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toast.error("Failed to update permissions"),
  });

  const toggle = (permissionId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      [permissionId]: { granted: checked, scope: prev[permissionId]?.scope ?? "ALL" },
    }));
  };

  const setScope = (permissionId: string, scope: PermissionScopeValue) => {
    setDraft((prev) => ({ ...prev, [permissionId]: { granted: true, scope } }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{role.name}</h2>
          <p className="text-sm text-muted-foreground">{role.description}</p>
        </div>
        {canAssign && (
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {groups?.map((group) => (
          <div key={group.resource} className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium capitalize">{group.resource.replace("-", " ")}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((permission) => {
                const entry = draft[permission.id];
                return (
                  <div key={permission.id} className="flex items-center gap-2">
                    <Checkbox
                      id={permission.id}
                      checked={entry?.granted ?? false}
                      disabled={!canAssign}
                      onCheckedChange={(checked) => toggle(permission.id, checked === true)}
                    />
                    <label htmlFor={permission.id} className="flex-1 text-sm">
                      {permission.action}
                    </label>
                    {entry?.granted && (
                      <Select
                        value={entry.scope}
                        onValueChange={(value) => setScope(permission.id, value as PermissionScopeValue)}
                        disabled={!canAssign}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCOPES.map((scope) => (
                            <SelectItem key={scope} value={scope}>
                              {scope}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
