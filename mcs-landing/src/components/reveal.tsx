"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type Direction = "left" | "right" | "up";

const offset: Record<Direction, { x: number; y: number }> = {
  left: { x: -64, y: 0 },
  right: { x: 64, y: 0 },
  up: { x: 0, y: 48 },
};

/**
 * Reveals children once when they scroll into view: a soft fade plus a subtle
 * directional slide. Fires a single time (`once`) and honors reduced-motion
 * globally via the CSS override. Used to slide images/text in from opposite
 * sides per the alternating layout.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
}) {
  const variants: Variants = {
    hidden: { opacity: 0, ...offset[direction] },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </motion.div>
  );
}
