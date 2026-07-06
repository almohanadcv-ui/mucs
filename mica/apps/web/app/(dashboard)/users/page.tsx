"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { InviteUserDialog } from "@/features/users/invite-user-dialog";
import { deleteUser, listUsers, suspendUser } from "@/features/users/api";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  INVITED: "secondary",
  SUSPENDED: "destructive",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const t = useTranslations("users");
  const ts = useTranslations("statuses");
  const tc = useTranslations("common");
  const canInvite = usePermission("users:invite");
  const canSuspend = usePermission("users:suspend");
  const canDelete = usePermission("users:delete");

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers({ page: 1, pageSize: 20 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const suspendMutation = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      toast.success(t("suspendedToast"));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success(t("removedToast"));
      invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canInvite && <InviteUserDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colRoles")}</TableHead>
              <TableHead>{t("colBranch")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status] ?? "secondary"}>
                    {ts(user.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.roles.map((r) => r.role.name).join("، ") || "—"}
                </TableCell>
                <TableCell>{user.branch?.name ?? "—"}</TableCell>
                <TableCell>
                  {(canSuspend || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canSuspend && user.status !== "SUSPENDED" && (
                          <DropdownMenuItem onClick={() => suspendMutation.mutate(user.id)}>
                            {tc("suspend")}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(user.id)}
                          >
                            {tc("remove")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
