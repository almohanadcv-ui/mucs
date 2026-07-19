"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

export function StarRating({
  max = 5,
  value,
  onChange,
}: {
  max?: number;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <motion.button
            key={n}
            type="button"
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${n}`}
          >
            <Star
              className={cn(
                "size-7 transition-colors",
                n <= active
                  ? "fill-warning text-warning"
                  : "fill-transparent text-muted-foreground/40",
              )}
            />
          </motion.button>
        ))}
      </div>
      {max === 5 && active > 0 && (
        <span className="text-xs text-muted-foreground">
          {t(`starLabels.${active}`)}
        </span>
      )}
    </div>
  );
}
