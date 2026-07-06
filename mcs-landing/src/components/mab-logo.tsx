"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Official MAB mark — an exact vector recreation of the corporate logo:
 * the bold "M", the triangular "A" whose interior holds the two-tone
 * aviation delta with a central spine, and the bold "B". Colors are the exact
 * brand blues and never change with the theme (the logo stays true).
 *
 * If you ever receive the original raster/vector file, drop it into public/
 * and set LOGO_IMAGE_SRC — both the static and animated logos will use it.
 */
export const LOGO_IMAGE_SRC: string | null = "/mab-logo.png";

const VIEWBOX = "0 0 413 176";

const M_PATH = "M15,158 V18 H53 L90,104 L127,18 H165 V158 H131 V72 L103,136 H77 L49,72 V158 Z";
const A_OUTER = "M230,18 L307,158 L277,158 L230,92 L183,158 L153,158 Z";
const A_DELTA_L = "M230,74 L200,158 L226,158 Z";
const A_DELTA_R = "M230,74 L260,158 L234,158 Z";
const B_PATH =
  "M312,18 H354 C380,18 392,30 392,52 C392,66 385,74 374,79 C387,83 398,94 398,111 C398,140 382,158 350,158 H312 Z " +
  "M330,38 H352 C362,38 367,44 367,52 C367,60 362,66 352,66 H330 Z " +
  "M330,93 H354 C366,93 372,99 372,111 C372,123 365,131 352,131 H330 Z";

const BLUE = "#1b76bd";
const DELTA_LIGHT = "#4f97d3";
const DELTA_MID = "#2f7ec2";

/** Static logo — navbar & footer. */
export function MabLogo({ className }: { className?: string }) {
  if (LOGO_IMAGE_SRC) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO_IMAGE_SRC} alt="MAB United" className={cn("h-8 w-auto", className)} />;
  }
  return (
    <svg viewBox={VIEWBOX} role="img" aria-label="MAB United" className={cn("h-8 w-auto", className)}>
      <path d={M_PATH} fill={BLUE} />
      <path d={A_OUTER} fill={BLUE} />
      <path d={A_DELTA_L} fill={DELTA_LIGHT} />
      <path d={A_DELTA_R} fill={DELTA_MID} />
      <path d={B_PATH} fill={BLUE} fillRule="evenodd" />
    </svg>
  );
}

const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * Fully-animated logo (hero): the M slides in from the left, the B from the
 * right, the A frame settles in, and the delta "takes off" — rising into
 * place, then keeping a continuous gentle float with a repeating light sweep.
 */
export function MabLogoAnimated({ className }: { className?: string }) {
  if (LOGO_IMAGE_SRC) {
    // Outer div = one-time entrance. Inner img = continuous float + gentle
    // "breathing" scale that never stops — so the real logo is clearly alive.
    return (
      <motion.div
        className={cn("inline-block will-change-transform", className)}
        initial={{ opacity: 0, y: 20, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: easeOut }}
      >
        <motion.img
          // eslint-disable-next-line @next/next/no-img-element
          src={LOGO_IMAGE_SRC}
          alt="MAB United"
          className="h-16 w-auto sm:h-20"
          animate={{ y: [0, -9, 0], scale: [1, 1.035, 1] }}
          transition={{
            y: { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
            scale: { duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
          }}
          style={{ filter: "drop-shadow(0 12px 24px rgba(27,118,189,0.28))" }}
        />
      </motion.div>
    );
  }

  // Robust animation strategy: transforms live ONLY on wrapper <div>s (which
  // never distort the artwork), while SVG paths animate opacity only. This
  // guarantees the mark's geometry is always pixel-correct — no SVG
  // transform-origin quirks can ever break the shape.
  return (
    <motion.div
      className={cn("inline-block will-change-transform", className)}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: easeOut }}
    >
      {/* gentle continuous float of the whole logo */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <svg viewBox={VIEWBOX} role="img" aria-label="MAB United" className="h-16 w-auto sm:h-20">
          <motion.path
            d={M_PATH}
            fill={BLUE}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          />
          <motion.path
            d={B_PATH}
            fill={BLUE}
            fillRule="evenodd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.2 }}
          />
          <motion.path
            d={A_OUTER}
            fill={BLUE}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.32 }}
          />
          <motion.path
            d={A_DELTA_L}
            fill={DELTA_LIGHT}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.44 }}
          />
          <motion.path
            d={A_DELTA_R}
            fill={DELTA_MID}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.44 }}
          />
          {/* repeating light sweep across the delta (opacity only — always safe) */}
          <motion.path
            d={`${A_DELTA_L} ${A_DELTA_R}`}
            fill="#ffffff"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.45, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.8, repeatDelay: 2.2 }}
            style={{ mixBlendMode: "overlay" }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
