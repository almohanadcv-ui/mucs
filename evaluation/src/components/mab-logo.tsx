import { cn } from "@/lib/utils";

/**
 * Official MAB wordmark — the same vector used across all MAB sites:
 * bold "M" + "B" with the aviation-style two-tone delta forming the "A".
 * Uses the exact brand blues (stays true in light and dark).
 */
export function MabLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 413 176"
      role="img"
      aria-label="MAB United"
      className={cn("h-8 w-auto", className)}
    >
      <path
        d="M15,158 V18 H53 L90,104 L127,18 H165 V158 H131 V72 L103,136 H77 L49,72 V158 Z"
        fill="#1b76bd"
      />
      <path d="M230,18 L307,158 L277,158 L230,92 L183,158 L153,158 Z" fill="#1b76bd" />
      <path d="M230,74 L200,158 L226,158 Z" fill="#4f97d3" />
      <path d="M230,74 L260,158 L234,158 Z" fill="#2f7ec2" />
      <path
        d="M312,18 H354 C380,18 392,30 392,52 C392,66 385,74 374,79 C387,83 398,94 398,111 C398,140 382,158 350,158 H312 Z M330,38 H352 C362,38 367,44 367,52 C367,60 362,66 352,66 H330 Z M330,93 H354 C366,93 372,99 372,111 C372,123 365,131 352,131 H330 Z"
        fill="#1b76bd"
        fillRule="evenodd"
      />
    </svg>
  );
}
