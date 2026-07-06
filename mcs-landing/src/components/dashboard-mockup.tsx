import type { LucideIcon } from "lucide-react";
import type { PreviewVariant } from "@/config/systems";

/**
 * A premium, generated dashboard preview rendered entirely in the DOM (no
 * binary asset needed). Tinted by each system's accent color and framed in a
 * browser window. Swap for a real screenshot later by setting `image` in the
 * system config — the section falls back to this only when no image is set.
 */
export function DashboardMockup({
  color,
  variant,
  name,
  icon: Icon,
}: {
  color: string;
  variant: PreviewVariant;
  name: string;
  icon: LucideIcon;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      style={{ boxShadow: `0 30px 60px -20px ${color}40` }}
    >
      {/* Accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: `${color}33` }}
      />

      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-background-subtle px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-[11px] font-medium text-muted-foreground">{name.toLowerCase().replace(/\s+/g, "")}.mucs.online</span>
        </div>
      </div>

      {/* App body */}
      <div className="flex min-h-[300px] gap-0 sm:min-h-[340px]">
        {/* Sidebar */}
        <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-border bg-background-subtle py-5 sm:flex">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-md"
              style={{ background: i === 0 ? `${color}22` : "var(--muted)" }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded-full bg-foreground/80" />
              <div className="h-2 w-40 rounded-full bg-muted-foreground/40" />
            </div>
            <div
              className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-white"
              style={{ background: color }}
            >
              {name}
            </div>
          </div>
          <Variant variant={variant} color={color} />
        </div>
      </div>
    </div>
  );
}

function Variant({ variant, color }: { variant: PreviewVariant; color: string }) {
  if (variant === "analytics") {
    const bars = [45, 68, 52, 80, 60, 92, 74];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-background-subtle p-3">
              <div className="mb-2 h-2 w-10 rounded-full bg-muted-foreground/40" />
              <div className="h-4 w-14 rounded-full" style={{ background: `${color}cc` }} />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-background-subtle p-4">
          <div className="flex h-28 items-end justify-between gap-2">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: i % 2 ? `${color}55` : color }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-background-subtle">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="h-2 w-16 rounded-full bg-muted-foreground/50" />
          <div className="ml-auto h-2 w-10 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <div className="h-6 w-6 rounded-md" style={{ background: `${color}22` }} />
            <div className="space-y-1.5">
              <div className="h-2 w-24 rounded-full bg-foreground/60" />
              <div className="h-1.5 w-16 rounded-full bg-muted-foreground/30" />
            </div>
            <div
              className="ml-auto rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{ background: `${color}1f`, color }}
            >
              {i % 2 ? "Active" : "Valid"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "kanban") {
    const cols = [3, 2, 3];
    return (
      <div className="grid grid-cols-3 gap-3">
        {cols.map((count, c) => (
          <div key={c} className="rounded-xl border border-border bg-background-subtle p-2.5">
            <div className="mb-2.5 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: c === 1 ? color : `${color}66` }} />
              <div className="h-2 w-10 rounded-full bg-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-2.5 shadow-sm">
                  <div className="mb-1.5 h-2 w-full rounded-full bg-foreground/50" />
                  <div className="h-1.5 w-2/3 rounded-full bg-muted-foreground/30" />
                  <div className="mt-2 flex gap-1">
                    <div className="h-4 w-4 rounded-full" style={{ background: `${color}55` }} />
                    <div className="h-4 w-4 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // form
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 flex flex-col items-center gap-3 rounded-xl border border-border bg-background-subtle p-4">
        <div className="h-16 w-16 rounded-full" style={{ background: `${color}33` }} />
        <div className="h-2 w-16 rounded-full bg-foreground/60" />
        <div className="h-2 w-12 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="col-span-2 space-y-3 rounded-xl border border-border bg-background-subtle p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-1.5 w-16 rounded-full bg-muted-foreground/40" />
            <div className="h-7 w-full rounded-md border border-border bg-card" />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <div className="h-7 w-24 rounded-md" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
}
