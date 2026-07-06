import { cn } from "@/lib/utils";

/**
 * Official MAB logo — the real brand image, shared across all MAB sites.
 * Same asset as the main landing page (public/mab-logo.png).
 */
export function MabLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mab-logo.png" alt="MAB United" className={cn("h-8 w-auto", className)} />
  );
}
