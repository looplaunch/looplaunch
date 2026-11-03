"use client";

import { motion, useReducedMotion } from "motion/react";

export const LOOPY_SRC = "/loopy.png";

interface LoopyMascotProps {
  size?: number;
  className?: string;
  /**
   * "hover" rests and waves when pointed at. "float" bobs on its own, for while Loopy is working.
   * "wave" loops a head tilt beside a speech bubble. "still" never moves.
   */
  mood?: "hover" | "float" | "wave" | "still";
}

const LOOPS = {
  float: { y: [0, -5, 0], rotate: [-2, 2, -2] },
  wave: { y: [0, -6, 0], rotate: [0, -6, 4, 0] },
};

const HOVER_WAVE = { rotate: [0, -8, 6, 0], y: [0, -4, 0], transition: { duration: 0.8, ease: "easeInOut" as const } };

/** Loopy, the Loop Launch mascot. Respects prefers-reduced-motion. */
export function LoopyMascot({ size = 64, className = "", mood = "hover" }: LoopyMascotProps) {
  const reduce = useReducedMotion();
  const loop = !reduce && (mood === "float" || mood === "wave") ? LOOPS[mood] : undefined;

  return (
    <motion.div
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      animate={loop}
      transition={{ duration: mood === "wave" ? 2.2 : 3.6, repeat: Infinity, ease: "easeInOut" }}
      whileHover={!reduce && mood === "hover" ? HOVER_WAVE : undefined}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOOPY_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="w-full h-full object-contain rounded-full"
      />
    </motion.div>
  );
}
