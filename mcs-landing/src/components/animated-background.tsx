"use client";

import { motion } from "framer-motion";

/**
 * Cinematic hero backdrop: a subtle grid + three slowly drifting gradient
 * "aurora" blobs. GPU-friendly (transform/opacity only) and respects reduced
 * motion via the global CSS override. Purely decorative → aria-hidden.
 */
export function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />

      <motion.div
        className="absolute -top-32 -left-24 h-[38rem] w-[38rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--brand) 55%, transparent), transparent 70%)",
        }}
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 10, 0], scale: [1, 1.1, 1.04, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-10 -right-32 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, #7c6cf0 45%, transparent), transparent 70%)",
        }}
        animate={{ x: [0, -50, 20, 0], y: [0, 30, -20, 0], scale: [1, 1.08, 1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, #12b886 40%, transparent), transparent 70%)",
        }}
        animate={{ x: [0, 40, -30, 0], y: [0, -30, 10, 0], scale: [1, 1.12, 1.02, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Fade the whole backdrop into the page background at the bottom edge. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
