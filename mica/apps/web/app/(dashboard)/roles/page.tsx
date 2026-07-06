"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/auth/use-permission";
import { listRoles } from "@/features/roles/api";
import { CreateRoleDialog } from "@/features/roles/create-role-dialog";
import { PermissionMatrix } from "@/features/roles/permission-matrix";

export default function RolesPage() {
  const canCreate = usePermission("roles:create");
  const { data: roles, isLoading } = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const selectedRole = roles?.find((r) => r.id === selectedRoleId) ?? roles?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
          <p className="text-muted-foreground">
            Manage the permission matrix that governs access across the system.
          </p>
        </div>
        {canCreate && <CreateRoleDialog />}
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          {roles?.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                (selectedRole?.id ?? roles[0]?.id) === role.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              <span>{role.name}</span>
              <Badge variant="secondary" className="ml-2">
                {role._count.users}
              </Badge>
            </button>
          ))}
        </div>

        <div>{selectedRole && <PermissionMatrix key={selectedRole.id} role={selectedRole} />}</div>
      </div>
    </div>
  );
}
