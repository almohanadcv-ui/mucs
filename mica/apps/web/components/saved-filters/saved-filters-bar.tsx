"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from "@/features/saved-filters/api";

interface SavedFiltersBarProps {
  module: string;
  currentFilter: Record<string, unknown>;
  onApply: (filter: Record<string, unknown>) => void;
}

/** Save/restore filter state per module (e.g. the vehicles list's search text) — persists across reloads. */
export function SavedFiltersBar({ module, currentFilter, onApply }: SavedFiltersBarProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const { data: filters } = useQuery({
    queryKey: ["saved-filters", module],
    queryFn: () => listSavedFilters(module),
  });

  const saveMutation = useMutation({
    mutationFn: () => createSavedFilter({ name, module, filterJson: currentFilter }),
    onSuccess: () => {
      toast.success("Filter saved");
      queryClient.invalidateQueries({ queryKey: ["saved-filters", module] });
      setSaving(false);
      setName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSavedFilter,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-filters", module] }),
  });

  if (saving) {
    return (
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-40"
          autoFocus
        />
        <Button size="sm" disabled={!name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSaving(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="size-4" /> Saved filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {!filters?.length && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No saved filters</p>
          )}
          {filters?.map((filter) => (
            <DropdownMenuItem
              key={filter.id}
              className="flex items-center justify-between gap-2"
              onSelect={() => onApply(filter.filterJson)}
            >
              {filter.name}
              <Trash2
                className="size-3.5 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(filter.id);
                }}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaving(true)}>Save current filter…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
