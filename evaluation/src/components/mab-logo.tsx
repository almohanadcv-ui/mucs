import { cn } from "@/lib/utils";

/**
 * Official MAB logo — the real brand image, shared across all MAB sites.
 * Same asset as the main landing page (public/mab-logo.png).
 */
export function MabLogo({ className }: { className?: string }) {
  // Prefix the base path when embedded in the portal (empty standalone), so the
  // asset resolves to /apps/evaluation/mab-logo.jpg and not the portal root.
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${base}/mab-logo.jpg`} alt="MAB United" className={cn("h-auto w-40 object-contain", className)} />
  );
}
