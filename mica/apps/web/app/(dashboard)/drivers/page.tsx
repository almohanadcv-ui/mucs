"use client";

import { useState } from "react";
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
import { CreateDriverDialog } from "@/features/drivers/create-driver-dialog";
import { LinkExistingUserDialog } from "@/features/drivers/link-existing-user-dialog";
import { deleteDriver, listDrivers, updateDriver, type DriverListItem } from "@/features/drivers/api";
import { InviteUserDialog } from "@/features/users/invite-user-dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  ON_LEAVE: "secondary",
  SUSPENDED: "destructive",
};

export default function DriversPage() {
  const queryClient = useQueryClient();
  const t = useTranslations("drivers");
  const ts = useTranslations("statuses");
  const tc = useTranslations("common");
  const canCreate = usePermission("drivers:create");
  const canDelete = usePermission("drivers:delete");
  const canUpdate = usePermission("drivers:update");
  const [linkingDriver, setLinkingDriver] = useState<DriverListItem | null>(null);
  const [linkingExistingDriver, setLinkingExistingDriver] = useState<DriverListItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => listDrivers({ page: 1, pageSize: 20 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      toast.success(t("removedToast"));
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => updateDriver(id, { userId }),
    onSuccess: () => {
      toast.success(t("linkedToast"));
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: () => toast.error(t("linkFailed")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && <CreateDriverDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmployeeCode")}</TableHead>
              <TableHead>{t("colLicense")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
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

            {data?.items.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell className="font-medium">
                  {driver.firstName} {driver.lastName}
                </TableCell>
                <TableCell>{driver.employeeCode}</TableCell>
                <TableCell>{driver.licenseNumber}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[driver.status] ?? "secondary"}>
                    {ts(driver.status)}
                  </Badge>
                </TableCell>
                <TableCell>{driver.branch?.name ?? "—"}</TableCell>
                <TableCell>
                  {(canDelete || canUpdate) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && !driver.userId && (
                          <DropdownMenuItem onClick={() => setLinkingExistingDriver(driver)}>
                            ربط بحساب موجود
                          </DropdownMenuItem>
                        )}
                        {canUpdate && !driver.userId && (
                          <DropdownMenuItem onClick={() => setLinkingDriver(driver)}>
                            {t("linkLoginAccount")}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(driver.id)}
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

      <LinkExistingUserDialog
        driver={linkingExistingDriver}
        open={!!linkingExistingDriver}
        onOpenChange={(next) => !next && setLinkingExistingDriver(null)}
      />

      <InviteUserDialog
        trigger={null}
        open={!!linkingDriver}
        onOpenChange={(next) => !next && setLinkingDriver(null)}
        lockedRoleName="Driver"
        defaultValues={
          linkingDriver
            ? { firstName: linkingDriver.firstName, lastName: linkingDriver.lastName }
            : undefined
        }
        onInvited={(user) => {
          if (linkingDriver) linkMutation.mutate({ id: linkingDriver.id, userId: user.id });
        }}
      />
    </div>
  );
}
