"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Car, IdCard, LayoutDashboard, Wrench } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch } from "@/features/search/api";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openHandler = () => setOpen(true);
    document.addEventListener("keydown", handler);
    window.addEventListener("open-command-palette", openHandler);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("open-command-palette", openHandler);
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["search", query],
    queryFn: () => globalSearch(query),
    enabled: query.length >= 2,
  });

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput placeholder="Search vehicles, drivers, work orders…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {query.length < 2 && (
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="size-4" /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/vehicles")}>
              <Car className="size-4" /> Vehicles
            </CommandItem>
            <CommandItem onSelect={() => go("/drivers")}>
              <IdCard className="size-4" /> Drivers
            </CommandItem>
            <CommandItem onSelect={() => go("/maintenance")}>
              <Wrench className="size-4" /> Maintenance
            </CommandItem>
          </CommandGroup>
        )}

        {!!data?.vehicles.length && (
          <CommandGroup heading="Vehicles">
            {data.vehicles.map((v) => (
              <CommandItem key={v.id} onSelect={() => go(`/vehicles/${v.id}`)}>
                <Car className="size-4" />
                {v.plateNumber} — {v.make} {v.model}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!data?.drivers.length && (
          <CommandGroup heading="Drivers">
            {data.drivers.map((d) => (
              <CommandItem key={d.id} onSelect={() => go("/drivers")}>
                <IdCard className="size-4" />
                {d.firstName} {d.lastName} ({d.employeeCode})
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!data?.maintenanceRequests.length && (
          <CommandGroup heading="Maintenance requests">
            {data.maintenanceRequests.map((m) => (
              <CommandItem key={m.id} onSelect={() => go(`/maintenance/${m.id}`)}>
                <Wrench className="size-4" />
                {m.requestNumber} — {m.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
