"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";

export interface PickerEmployee {
  id: string;
  employeeNo: string;
  name: string;
  nameEn: string | null;
  jobTitle: string | null;
  department: { name: string } | null;
  branch: { name: string } | null;
  evaluator: { name: string } | null;
}

/**
 * One search box for the evaluation flow: type a name / employee no / national
 * id and pick from a rich dropdown. Debounced + server-side capped so it stays
 * instant even with thousands of employees (no full-list fetch).
 */
export function EmployeeSearchCombobox({
  value,
  onSelect,
}: {
  value: PickerEmployee | null;
  onSelect: (e: PickerEmployee | null) => void;
}) {
  const t = useT();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["employee-search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/employees/search?q=${encodeURIComponent(debounced)}`);
      const b = await res.json().catch(() => null);
      return ((b?.data ?? b) as PickerEmployee[]) ?? [];
    },
    enabled: debounced.trim().length > 0 && open,
    staleTime: 30_000,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {value.name} <span className="text-xs text-muted-foreground">— {value.employeeNo}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[value.department?.name, value.branch?.name, value.jobTitle]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          title={t("picker.changeEmployee")}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pr-9"
        placeholder={t("picker.searchPlaceholder")}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && debounced.trim().length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {isFetching && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("picker.searching")}
            </div>
          )}
          {!isFetching && (data?.length ?? 0) === 0 && (
            <p className="p-3 text-sm text-muted-foreground">{t("picker.noMatch")}</p>
          )}
          {data?.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onSelect(e);
                setOpen(false);
                setTerm("");
              }}
              className="block w-full border-b px-3 py-2 text-right last:border-0 hover:bg-accent"
            >
              <p className="font-medium">
                {e.name}
                <span className="text-xs text-muted-foreground"> — {e.employeeNo}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {[e.department?.name, e.branch?.name, e.jobTitle, e.evaluator?.name && t("picker.evaluatorPrefix", { name: e.evaluator.name })]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
