"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/lib/auth/use-permission";
import { consumeSparePart, listSparePartUsage } from "./api";
import { listSpareParts } from "@/features/spare-parts/api";

export function SparePartsPanel({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const canUpdate = usePermission("maintenance:update");
  const [sparePartId, setSparePartId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");

  const { data: usage } = useQuery({
    queryKey: ["maintenance", requestId, "spare-parts"],
    queryFn: () => listSparePartUsage(requestId),
  });
  const { data: catalog } = useQuery({ queryKey: ["spare-parts"], queryFn: () => listSpareParts() });

  const mutation = useMutation({
    mutationFn: () => consumeSparePart(requestId, sparePartId, Number(quantity)),
    onSuccess: () => {
      toast.success("Spare part recorded");
      queryClient.invalidateQueries({ queryKey: ["maintenance", requestId, "spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      setQuantity("1");
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? "Failed to record usage"
        : "Failed to record usage";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Part</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usage?.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {row.sparePart.name} ({row.sparePart.sku})
              </TableCell>
              <TableCell>{row.quantityUsed}</TableCell>
              <TableCell>{row.unitCostAtUse}</TableCell>
            </TableRow>
          ))}
          {!usage?.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No parts used yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {canUpdate && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Select value={sparePartId} onValueChange={setSparePartId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a spare part" />
              </SelectTrigger>
              <SelectContent>
                {catalog?.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.name} ({part.quantityOnHand} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20"
          />
          <Button
            disabled={!sparePartId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Use
          </Button>
        </div>
      )}
    </div>
  );
}
